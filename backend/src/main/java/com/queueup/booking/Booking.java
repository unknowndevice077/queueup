package com.queueup.booking;

import com.queueup.catalog.ServiceOffering;
import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import com.queueup.user.AppUser;
import com.queueup.user.Membership;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Getter
@Setter
@Entity
@Table(name = "booking")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class Booking extends TenantScopedEntity {

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "customer_id", nullable = false, updatable = false)
  private AppUser customer;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "staff_membership_id", nullable = false)
  private Membership staff;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "service_id", nullable = false, updatable = false)
  private ServiceOffering service;

  @Column(name = "starts_at", nullable = false)
  private Instant startsAt;

  /** End of the blocked interval: start + service duration + service buffer. */
  @Column(name = "ends_at", nullable = false)
  private Instant endsAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private BookingStatus status;

  @Column(name = "price_centavos", nullable = false)
  private long priceCentavos;

  @Column(name = "deposit_centavos", nullable = false)
  private long depositCentavos;

  @Column(length = 500)
  private String notes;

  @Column(name = "cancelled_reason")
  private String cancelledReason;

  @Version
  private long version;
}
