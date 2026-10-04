package com.queueup.notification;

import java.util.UUID;

/** Published inside the booking transaction; handled only after it commits. */
public record BookingNotificationEvent(UUID bookingId, NotificationType type) {
}
