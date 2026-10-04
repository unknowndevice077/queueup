package com.queueup.notification;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Getter
@Setter
@Entity
@Table(name = "notification_log")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class NotificationLog extends TenantScopedEntity {

  @Column(name = "booking_id", nullable = false, updatable = false)
  private UUID bookingId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private NotificationType type;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private NotificationChannel channel;

  @Column(nullable = false, length = 254)
  private String recipient;

  @Column(name = "sent_at")
  private Instant sentAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private NotificationStatus status;

  @Column(length = 500)
  private String error;
}
