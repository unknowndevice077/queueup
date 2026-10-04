package com.queueup.payment;

import com.queueup.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "webhook_event")
public class WebhookEvent extends BaseEntity {

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private PaymentProvider provider;

  @Column(name = "event_id", nullable = false, unique = true, length = 100)
  private String eventId;

  @Column(name = "event_type", length = 100)
  private String eventType;

  @Column(name = "received_at", nullable = false)
  private Instant receivedAt;

  @Column(name = "processed_at")
  private Instant processedAt;
}
