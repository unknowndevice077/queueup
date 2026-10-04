package com.queueup.booking;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.booking.dto.BookingResponse;
import com.queueup.booking.dto.CreateBookingRequest;
import com.queueup.booking.dto.RescheduleBookingRequest;
import com.queueup.booking.dto.StaffAvailabilityResponse;
import com.queueup.catalog.ServiceOffering;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.exception.SlotUnavailableException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import com.queueup.common.web.PageResponse;
import com.queueup.notification.BookingNotificationEvent;
import com.queueup.notification.NotificationType;
import com.queueup.tenant.Tenant;
import com.queueup.tenant.TenantRepository;
import com.queueup.user.AppUserRepository;
import com.queueup.user.Membership;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Booking lifecycle. Double booking is prevented in three layers: the slot is re-validated server-side,
 * the PostgreSQL exclusion constraint rejects overlapping rows (translated to 409), and optimistic locking
 * guards concurrent status changes on the same booking.
 */
@Service
public class BookingService {

  private static final Logger log = LoggerFactory.getLogger(BookingService.class);
  private static final String ENTITY = "BOOKING";
  private static final String EXCLUSION_VIOLATION = "23P01";

  private final BookingRepository bookingRepository;
  private final TenantRepository tenantRepository;
  private final AppUserRepository userRepository;
  private final AvailabilityService availabilityService;
  private final BookingMapper mapper;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;
  private final ApplicationEventPublisher events;
  private final Clock clock;

  public BookingService(BookingRepository bookingRepository, TenantRepository tenantRepository,
      AppUserRepository userRepository, AvailabilityService availabilityService, BookingMapper mapper,
      TenantAccess tenantAccess, AuditService auditService, ApplicationEventPublisher events, Clock clock) {
    this.bookingRepository = bookingRepository;
    this.tenantRepository = tenantRepository;
    this.userRepository = userRepository;
    this.availabilityService = availabilityService;
    this.mapper = mapper;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
    this.events = events;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<StaffAvailabilityResponse> availability(UUID serviceId, LocalDate date, UUID staffId) {
    Tenant tenant = currentTenant();
    ServiceOffering service = availabilityService.requireActiveService(tenant.getId(), serviceId);
    return availabilityService.availability(tenant, service, date, staffId, null).stream()
        .map(s -> new StaffAvailabilityResponse(s.staff().getId(), s.staff().getUser().getFullName(),
            s.slots().stream().map(slot -> slot.toOffsetDateTime()).toList()))
        .toList();
  }

  @Transactional
  public BookingResponse create(CreateBookingRequest request, AuthUser caller) {
    Tenant tenant = currentTenant();
    ServiceOffering service = availabilityService.requireActiveService(tenant.getId(), request.serviceId());
    Instant start = request.startsAt().toInstant();
    Membership staff = pickAvailableStaff(tenant, service, start, request.staffId(), null);

    long deposit = DepositCalculator.depositCentavos(service.getPriceCentavos(), tenant.isDepositRequired(),
        tenant.getDepositPercent());
    Booking booking = new Booking();
    booking.setTenantId(tenant.getId());
    booking.setCustomer(userRepository.getReferenceById(caller.id()));
    booking.setStaff(staff);
    booking.setService(service);
    booking.setStartsAt(start);
    booking.setEndsAt(start.plus(Duration.ofMinutes(service.blockMinutes())));
    booking.setPriceCentavos(service.getPriceCentavos());
    booking.setDepositCentavos(deposit);
    booking.setStatus(deposit > 0 ? BookingStatus.PENDING_PAYMENT : BookingStatus.CONFIRMED);
    booking.setNotes(request.notes());
    saveGuardingOverlap(booking);

    auditService.record(tenant.getId(), caller.id(), AuditAction.BOOKING_CREATED, ENTITY, booking.getId(),
        Map.of("startsAt", start.toString(), "staffId", staff.getId().toString(),
            "status", booking.getStatus().name()));
    if (booking.getStatus() == BookingStatus.CONFIRMED) {
      events.publishEvent(new BookingNotificationEvent(booking.getId(), NotificationType.CONFIRMATION));
    }
    return toResponse(booking, tenant);
  }

  @Transactional(readOnly = true)
  public PageResponse<BookingResponse> search(LocalDate from, LocalDate to, UUID staffId, BookingStatus status,
      Pageable pageable) {
    TenantContext context = tenantAccess.requireMember();
    Tenant tenant = currentTenant();
    ZoneId zone = context.zone();
    LocalDate start = from != null ? from : LocalDate.now(clock.withZone(zone));
    LocalDate end = to != null ? to : start.plusDays(6);
    Page<Booking> page = bookingRepository.search(context.tenantId(), start.atStartOfDay(zone).toInstant(),
        end.plusDays(1).atStartOfDay(zone).toInstant(), staffId, status, pageable);
    TenantView view = TenantView.of(tenant);
    return PageResponse.from(page, booking -> mapper.toResponse(booking, view));
  }

  @Transactional(readOnly = true)
  public PageResponse<BookingResponse> myBookings(AuthUser caller, Pageable pageable) {
    Page<Booking> page = bookingRepository.findForCustomer(caller.id(), pageable);
    Map<UUID, TenantView> tenants = tenantRepository
        .findAllById(page.getContent().stream().map(Booking::getTenantId).distinct().toList()).stream()
        .collect(Collectors.toMap(Tenant::getId, TenantView::of));
    Function<Booking, BookingResponse> toResponse = b -> mapper.toResponse(b, tenants.get(b.getTenantId()));
    return PageResponse.from(page, toResponse);
  }

  @Transactional(readOnly = true)
  public BookingResponse get(UUID bookingId, AuthUser caller) {
    Tenant tenant = currentTenant();
    Booking booking = findVisibleBooking(bookingId, caller);
    return toResponse(booking, tenant);
  }

  @Transactional
  public BookingResponse cancel(UUID bookingId, String reason, AuthUser caller) {
    Tenant tenant = currentTenant();
    Booking booking = findVisibleBooking(bookingId, caller);
    requireBlocking(booking, "cancelled");
    if (!TenantContext.require().isMember()) {
      requireWithinCustomerWindow(booking, tenant);
    }
    booking.setStatus(BookingStatus.CANCELLED);
    booking.setCancelledReason(reason == null || reason.isBlank() ? "Cancelled" : reason.trim());
    bookingRepository.flush();
    auditService.record(tenant.getId(), caller.id(), AuditAction.BOOKING_CANCELLED, ENTITY, booking.getId(),
        Map.of("reason", booking.getCancelledReason()));
    events.publishEvent(new BookingNotificationEvent(booking.getId(), NotificationType.CANCELLATION));
    return toResponse(booking, tenant);
  }

  @Transactional
  public BookingResponse complete(UUID bookingId, AuthUser caller) {
    return transitionByStaff(bookingId, caller, BookingStatus.COMPLETED, AuditAction.BOOKING_COMPLETED);
  }

  @Transactional
  public BookingResponse markNoShow(UUID bookingId, AuthUser caller) {
    tenantAccess.requireMember();
    Booking booking = findTenantBooking(bookingId);
    if (clock.instant().isBefore(booking.getStartsAt())) {
      throw new ConflictException("A booking can only be marked as no-show after its start time");
    }
    return transitionByStaff(bookingId, caller, BookingStatus.NO_SHOW, AuditAction.BOOKING_NO_SHOW);
  }

  @Transactional
  public BookingResponse reschedule(UUID bookingId, RescheduleBookingRequest request, AuthUser caller) {
    Tenant tenant = currentTenant();
    Booking booking = findVisibleBooking(bookingId, caller);
    requireBlocking(booking, "rescheduled");
    if (!TenantContext.require().isMember()) {
      requireWithinCustomerWindow(booking, tenant);
    }
    Instant start = request.startsAt().toInstant();
    UUID staffId = request.staffId() != null ? request.staffId() : booking.getStaff().getId();
    Membership staff = pickAvailableStaff(tenant, booking.getService(), start, staffId, booking.getId());
    Instant previousStart = booking.getStartsAt();
    booking.setStaff(staff);
    booking.setStartsAt(start);
    booking.setEndsAt(start.plus(Duration.ofMinutes(booking.getService().blockMinutes())));
    saveGuardingOverlap(booking);
    auditService.record(tenant.getId(), caller.id(), AuditAction.BOOKING_RESCHEDULED, ENTITY, booking.getId(),
        Map.of("from", previousStart.toString(), "to", start.toString(), "staffId", staff.getId().toString()));
    return toResponse(booking, tenant);
  }

  /** Confirms a booking whose deposit was paid. Called by the payment webhook (no tenant context). */
  @Transactional
  public boolean confirmAfterPayment(UUID bookingId) {
    Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> NotFoundException.of("Booking"));
    if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
      log.warn("Payment received for booking {} in status {}; leaving it unchanged", bookingId, booking.getStatus());
      return false;
    }
    booking.setStatus(BookingStatus.CONFIRMED);
    auditService.record(booking.getTenantId(), null, AuditAction.BOOKING_CONFIRMED, ENTITY, booking.getId(),
        Map.of("reason", "deposit paid"));
    events.publishEvent(new BookingNotificationEvent(booking.getId(), NotificationType.CONFIRMATION));
    return true;
  }

  /** Cancels PENDING_PAYMENT bookings older than the payment TTL, freeing their slots. */
  @Transactional
  public int expireStalePendingPayments(Duration ttl) {
    Instant cutoff = clock.instant().minus(ttl);
    List<UUID> ids = bookingRepository.findIdsByStatusCreatedBefore(BookingStatus.PENDING_PAYMENT, cutoff);
    int expired = 0;
    for (Booking booking : bookingRepository.findAllById(ids)) {
      if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
        continue;
      }
      booking.setStatus(BookingStatus.CANCELLED);
      booking.setCancelledReason("Deposit not paid in time");
      auditService.record(booking.getTenantId(), null, AuditAction.BOOKING_EXPIRED, ENTITY, booking.getId(),
          Map.of("createdAt", booking.getCreatedAt().toString()));
      expired++;
    }
    if (expired > 0) {
      log.info("Expired {} unpaid bookings", expired);
    }
    return expired;
  }

  private BookingResponse transitionByStaff(UUID bookingId, AuthUser caller, BookingStatus target,
      AuditAction action) {
    TenantContext context = tenantAccess.requireMember();
    Booking booking = findTenantBooking(bookingId);
    if (booking.getStatus() != BookingStatus.CONFIRMED) {
      throw new ConflictException("Only confirmed bookings can be marked " + target.name().toLowerCase());
    }
    booking.setStatus(target);
    bookingRepository.flush();
    auditService.record(context.tenantId(), caller.id(), action, ENTITY, booking.getId(), Map.of());
    return toResponse(booking, currentTenant());
  }

  private Membership pickAvailableStaff(Tenant tenant, ServiceOffering service, Instant start, UUID staffId,
      UUID excludeBookingId) {
    LocalDate date = start.atZone(tenant.zoneId()).toLocalDate();
    return availabilityService.availability(tenant, service, date, staffId, excludeBookingId).stream()
        .filter(s -> s.slots().stream().anyMatch(slot -> slot.toInstant().equals(start)))
        .map(AvailabilityService.StaffSlots::staff)
        .findFirst()
        .orElseThrow(SlotUnavailableException::new);
  }

  private void saveGuardingOverlap(Booking booking) {
    try {
      bookingRepository.saveAndFlush(booking);
    } catch (DataIntegrityViolationException ex) {
      if (isExclusionViolation(ex)) {
        throw new SlotUnavailableException();
      }
      throw ex;
    }
  }

  private Booking findTenantBooking(UUID bookingId) {
    return bookingRepository.findDetailedByIdAndTenantId(bookingId, TenantContext.require().tenantId())
        .orElseThrow(() -> NotFoundException.of("Booking"));
  }

  /** Members see every booking of the tenant; anyone else only their own (others answer 404). */
  @Transactional(readOnly = true)
  public Booking findVisibleBooking(UUID bookingId, AuthUser caller) {
    Booking booking = findTenantBooking(bookingId);
    boolean isOwnBooking = Objects.equals(booking.getCustomer().getId(), caller.id());
    if (!TenantContext.require().isMember() && !isOwnBooking) {
      throw NotFoundException.of("Booking");
    }
    return booking;
  }

  private void requireBlocking(Booking booking, String verb) {
    if (!booking.getStatus().isBlocking()) {
      throw new ConflictException("A " + booking.getStatus() + " booking cannot be " + verb);
    }
  }

  private void requireWithinCustomerWindow(Booking booking, Tenant tenant) {
    if (!CancellationPolicy.customerMayChange(booking.getStartsAt(), clock.instant(),
        tenant.getCancellationWindowHours())) {
      throw new ConflictException("Changes are only allowed until " + tenant.getCancellationWindowHours()
          + " hours before the appointment. Please contact the business.");
    }
  }

  private Tenant currentTenant() {
    return tenantRepository.findById(TenantContext.require().tenantId())
        .orElseThrow(() -> new NotFoundException("Business not found"));
  }

  private BookingResponse toResponse(Booking booking, Tenant tenant) {
    return mapper.toResponse(booking, TenantView.of(tenant));
  }

  private static boolean isExclusionViolation(Throwable ex) {
    for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLException sql && EXCLUSION_VIOLATION.equals(sql.getSQLState())) {
        return true;
      }
    }
    return false;
  }
}
