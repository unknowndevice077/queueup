package com.queueup.queue.dto;

import com.queueup.queue.QueueStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** The ticket handed to the walk-in customer who just joined. */
public record QueueTicketResponse(
    UUID id,
    LocalDate queueDate,
    int ticketNumber,
    QueueStatus status,
    int position,
    String customerName,
    String serviceName,
    Instant joinedAt) {
}
