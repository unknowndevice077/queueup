package com.queueup.queue.dto;

import com.queueup.queue.QueueStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Today's queue as shown publicly and broadcast over WebSocket. Never contains names or phone numbers. */
public record PublicQueueState(
    String tenantSlug,
    LocalDate queueDate,
    int waitingCount,
    List<Entry> entries,
    Instant generatedAt) {

  /** One ticket; {@code position} is 1-based among waiting tickets, 0 otherwise. */
  public record Entry(UUID id, int ticketNumber, QueueStatus status, int position, String serviceName,
      Instant calledAt) {
  }
}
