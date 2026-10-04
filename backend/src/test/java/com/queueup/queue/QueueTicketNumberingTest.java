package com.queueup.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.queueup.audit.AuditService;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import com.queueup.queue.dto.JoinQueueRequest;
import com.queueup.queue.dto.QueueTicketResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class QueueTicketNumberingTest {

  private static final UUID TENANT_ID = UUID.randomUUID();

  @Mock
  private QueueEntryRepository entryRepository;
  @Mock
  private QueueCounterRepository counterRepository;
  @Mock
  private ServiceOfferingRepository serviceRepository;
  @Mock
  private AuditService auditService;
  @Mock
  private ApplicationEventPublisher events;

  @AfterEach
  void clearContext() {
    TenantContext.clear();
  }

  @Test
  void ticketNumberComesFromTheCounterForTheTenantLocalDay() {
    // 23:30 UTC on Oct 5 is already Oct 6 in Manila, so the ticket belongs to Oct 6.
    QueueService service = serviceAt("2026-10-05T23:30:00Z");
    when(counterRepository.nextNumber(TENANT_ID, LocalDate.of(2026, 10, 6))).thenReturn(7);
    when(entryRepository.save(any(QueueEntry.class))).thenAnswer(inv -> inv.getArgument(0));
    when(entryRepository.findAllForDay(eq(TENANT_ID), any())).thenReturn(List.of());

    QueueTicketResponse ticket = service.join(new JoinQueueRequest("Juan", "09171234567", null));

    assertThat(ticket.ticketNumber()).isEqualTo(7);
    assertThat(ticket.queueDate()).isEqualTo(LocalDate.of(2026, 10, 6));
    assertThat(ticket.status()).isEqualTo(QueueStatus.WAITING);
    verify(events).publishEvent(new QueueChangedEvent(TENANT_ID, "kanto-cuts"));
  }

  @Test
  void sequentialJoinsGetSequentialNumbers() {
    QueueService service = serviceAt("2026-10-05T02:00:00Z");
    when(counterRepository.nextNumber(TENANT_ID, LocalDate.of(2026, 10, 5))).thenReturn(1, 2, 3);
    when(entryRepository.save(any(QueueEntry.class))).thenAnswer(inv -> inv.getArgument(0));
    when(entryRepository.findAllForDay(eq(TENANT_ID), any())).thenReturn(List.of());

    List<Integer> numbers = List.of(
        service.join(new JoinQueueRequest("A", "09170000001", null)).ticketNumber(),
        service.join(new JoinQueueRequest("B", "09170000002", null)).ticketNumber(),
        service.join(new JoinQueueRequest("C", "09170000003", null)).ticketNumber());

    assertThat(numbers).containsExactly(1, 2, 3);
  }

  private QueueService serviceAt(String instant) {
    TenantContext.set(new TenantContext(TENANT_ID, "kanto-cuts", ZoneId.of("Asia/Manila"), null, null));
    return new QueueService(entryRepository, counterRepository, serviceRepository, new TenantAccess(), auditService,
        events, Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
  }
}
