package com.queueup.payment;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "payment")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class Payment extends TenantScopedEntity {

  @Column(name = "booking_id", nullable = false, updatable = false)
  private UUID bookingId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private PaymentProvider provider;

  @Column(name = "provider_reference", length = 100)
  private String providerReference;

  @Column(name = "checkout_url", length = 500)
  private String checkoutUrl;

  @Column(name = "amount_centavos", nullable = false)
  private long amountCentavos;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private PaymentStatus status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_payload", columnDefinition = "jsonb")
  private Map<String, Object> rawPayload;
}
