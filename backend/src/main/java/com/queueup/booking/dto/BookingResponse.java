package com.queueup.booking.dto;

import com.queueup.booking.BookingStatus;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A booking as seen by customers and staff. Times are tenant-local with offset; {@code endsAt} is the end of the
 * service itself (the clean-up buffer is internal). Money is in centavos.
 */
public record BookingResponse(
    UUID id,
    UUID tenantId,
    String tenantSlug,
    String tenantName,
    String timezone,
    UUID serviceId,
    String serviceName,
    int durationMinutes,
    UUID staffId,
    String staffName,
    UUID customerId,
    String customerName,
    String customerEmail,
    String customerPhone,
    OffsetDateTime startsAt,
    OffsetDateTime endsAt,
    BookingStatus status,
    long priceCentavos,
    long depositCentavos,
    String notes,
    String cancelledReason,
    OffsetDateTime customerChangeDeadline,
    Instant createdAt) {
}
