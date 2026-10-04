package com.queueup.queue;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.catalog.ServiceOffering;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import com.queueup.queue.dto.JoinQueueRequest;
import com.queueup.queue.dto.PublicQueueState;
import com.queueup.queue.dto.QueueTicketResponse;
import com.queueup.queue.dto.StaffQueueEntry;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Walk-in queue. Ticket numbers restart every tenant-local day and are allocated atomically. Every change
 * publishes a {@link QueueChangedEvent} so displays update live.
 */
@Service
public class QueueService {

  private static final String ENTITY = "QUEUE_ENTRY";

  private final QueueEntryRepository entryRepository;
  private final QueueCounterRepository counterRepository;
  private final ServiceOfferingRepository serviceRepository;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;
  private final ApplicationEventPublisher events;
  private final Clock clock;

  public QueueService(QueueEntryRepository entryRepository, QueueCounterRepository counterRepository,
      ServiceOfferingRepository serviceRepository, TenantAccess tenantAccess, AuditService auditService,
      ApplicationEventPublisher events, Clock clock) {
    this.entryRepository = entryRepository;
    this.counterRepository = counterRepository;
    this.serviceRepository = serviceRepository;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
    this.events = events;
    this.clock = clock;
  }

  @Transactional
  public QueueTicketResponse join(JoinQueueRequest request) {
    TenantContext context = TenantContext.require();
    ServiceOffering service = null;
    if (request.serviceId() != null) {
      service = serviceRepository.findByIdAndTenantId(request.serviceId(), context.tenantId())
          .filter(ServiceOffering::isActive)
          .orElseThrow(() -> NotFoundException.of("Service"));
    }
    Instant now = clock.instant();
    LocalDate queueDate = today(context.zone());
    QueueEntry entry = new QueueEntry();
    entry.setTenantId(context.tenantId());
    entry.setQueueDate(queueDate);
    entry.setTicketNumber(counterRepository.nextNumber(context.tenantId(), queueDate));
    entry.setCustomerName(request.customerName().trim());
    entry.setCustomerPhone(request.customerPhone().trim());
    entry.setService(service);
    entry.setStatus(QueueStatus.WAITING);
    entry.setJoinedAt(now);
    entryRepository.save(entry);

    auditService.record(context.tenantId(), null, AuditAction.QUEUE_JOINED, ENTITY, entry.getId(),
        Map.of("ticketNumber", entry.getTicketNumber()));
    publishChange(context);
    int position = positionOf(entry, entryRepository.findAllForDay(context.tenantId(), queueDate));
    return new QueueTicketResponse(entry.getId(), queueDate, entry.getTicketNumber(), entry.getStatus(), position,
        entry.getCustomerName(), service == null ? null : service.getName(), now);
  }

  @Transactional(readOnly = true)
  public PublicQueueState publicState() {
    TenantContext context = TenantContext.require();
    return publicState(context.tenantId(), context.slug(), context.zone());
  }

  /** Builds the public state in its own read transaction (also used after commit by the broadcaster). */
  @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
  public PublicQueueState publicState(UUID tenantId, String slug, ZoneId zone) {
    LocalDate date = today(zone);
    List<QueueEntry> entries = entryRepository.findAllForDay(tenantId, date);
    List<PublicQueueState.Entry> items = new ArrayList<>();
    int waitingPosition = 0;
    for (QueueEntry entry : entries) {
      int position = entry.getStatus() == QueueStatus.WAITING ? ++waitingPosition : 0;
      items.add(new PublicQueueState.Entry(entry.getId(), entry.getTicketNumber(), entry.getStatus(), position,
          entry.getService() == null ? null : entry.getService().getName(), entry.getCalledAt()));
    }
    return new PublicQueueState(slug, date, waitingPosition, items, clock.instant());
  }

  @Transactional(readOnly = true)
  public List<StaffQueueEntry> staffView() {
    TenantContext context = tenantAccess.requireMember();
    List<QueueEntry> entries = entryRepository.findAllForDay(context.tenantId(), today(context.zone()));
    List<StaffQueueEntry> result = new ArrayList<>();
    int waitingPosition = 0;
    for (QueueEntry entry : entries) {
      int position = entry.getStatus() == QueueStatus.WAITING ? ++waitingPosition : 0;
      result.add(toStaffEntry(entry, position));
    }
    return result;
  }

  @Transactional
  public StaffQueueEntry callNext(AuthUser caller) {
    TenantContext context = tenantAccess.requireMember();
    QueueEntry entry = entryRepository.claimNextWaiting(context.tenantId(), today(context.zone()))
        .orElseThrow(() -> new NotFoundException("No customers are waiting"));
    entry.setStatus(QueueStatus.CALLED);
    entry.setCalledAt(clock.instant());
    entry.setServedBy(context.membershipId());
    return finishAction(context, caller, entry, AuditAction.QUEUE_CALLED);
  }

  @Transactional
  public StaffQueueEntry serve(UUID entryId, AuthUser caller) {
    return transition(entryId, caller, EnumSet.of(QueueStatus.WAITING, QueueStatus.CALLED), QueueStatus.SERVING,
        AuditAction.QUEUE_SERVING);
  }

  @Transactional
  public StaffQueueEntry done(UUID entryId, AuthUser caller) {
    return transition(entryId, caller, EnumSet.of(QueueStatus.CALLED, QueueStatus.SERVING), QueueStatus.DONE,
        AuditAction.QUEUE_DONE);
  }

  @Transactional
  public StaffQueueEntry skip(UUID entryId, AuthUser caller) {
    return transition(entryId, caller, EnumSet.of(QueueStatus.WAITING, QueueStatus.CALLED), QueueStatus.SKIPPED,
        AuditAction.QUEUE_SKIPPED);
  }

  private StaffQueueEntry transition(UUID entryId, AuthUser caller, Set<QueueStatus> allowedFrom,
      QueueStatus target, AuditAction action) {
    TenantContext context = tenantAccess.requireMember();
    QueueEntry entry = entryRepository.findByIdAndTenantId(entryId, context.tenantId())
        .orElseThrow(() -> NotFoundException.of("Queue entry"));
    if (!allowedFrom.contains(entry.getStatus())) {
      throw new ConflictException("Ticket " + entry.getTicketNumber() + " is " + entry.getStatus()
          + " and cannot become " + target);
    }
    Instant now = clock.instant();
    if (entry.getCalledAt() == null && target != QueueStatus.SKIPPED) {
      entry.setCalledAt(now);
    }
    if (target == QueueStatus.DONE || target == QueueStatus.SKIPPED) {
      entry.setFinishedAt(now);
    }
    if (entry.getServedBy() == null && target != QueueStatus.SKIPPED) {
      entry.setServedBy(context.membershipId());
    }
    entry.setStatus(target);
    return finishAction(context, caller, entry, action);
  }

  private StaffQueueEntry finishAction(TenantContext context, AuthUser caller, QueueEntry entry, AuditAction action) {
    auditService.record(context.tenantId(), caller.id(), action, ENTITY, entry.getId(),
        Map.of("ticketNumber", entry.getTicketNumber()));
    publishChange(context);
    return toStaffEntry(entry, 0);
  }

  private void publishChange(TenantContext context) {
    events.publishEvent(new QueueChangedEvent(context.tenantId(), context.slug()));
  }

  private LocalDate today(ZoneId zone) {
    return LocalDate.now(clock.withZone(zone));
  }

  private static int positionOf(QueueEntry target, List<QueueEntry> dayEntries) {
    int position = 0;
    for (QueueEntry entry : dayEntries) {
      if (entry.getStatus() == QueueStatus.WAITING) {
        position++;
        if (entry.getId().equals(target.getId())) {
          return position;
        }
      }
    }
    return 0;
  }

  private static StaffQueueEntry toStaffEntry(QueueEntry entry, int position) {
    ServiceOffering service = entry.getService();
    return new StaffQueueEntry(entry.getId(), entry.getTicketNumber(), entry.getStatus(), position,
        entry.getCustomerName(), entry.getCustomerPhone(), service == null ? null : service.getId(),
        service == null ? null : service.getName(), entry.getJoinedAt(), entry.getCalledAt(), entry.getFinishedAt(),
        entry.getServedBy());
  }
}
