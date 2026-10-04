package com.queueup.notification;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID> {

  boolean existsByBookingIdAndTypeAndChannelAndStatus(UUID bookingId, NotificationType type,
      NotificationChannel channel, NotificationStatus status);

  List<NotificationLog> findAllByBookingId(UUID bookingId);
}
