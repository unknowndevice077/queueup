package com.queueup.queue.dto;

import com.queueup.queue.QueueStatus;
import java.time.Instant;
import java.util.UUID;

/** Full queue entry for the staff console, including contact details. */
public record StaffQueueEntry(
    UUID id,
    int ticketNumber,
    QueueStatus status,
    int position,
    String customerName,
    String customerPhone,
    UUID serviceId,
    String serviceName,
    Instant joinedAt,
    Instant calledAt,
    Instant finishedAt,
    UUID servedBy) {
}
