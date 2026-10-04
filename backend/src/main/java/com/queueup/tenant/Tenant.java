package com.queueup.tenant;

import com.queueup.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.ZoneId;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "tenant")
public class Tenant extends BaseEntity {

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false, length = 60, unique = true, updatable = false)
  private String slug;

  @Column(nullable = false, length = 64)
  private String timezone = "Asia/Manila";

  @Column(nullable = false, length = 3)
  private String currency = "PHP";

  @Column(name = "contact_email")
  private String contactEmail;

  @Column(name = "contact_phone")
  private String contactPhone;

  private String address;

  @Column(name = "booking_lead_time_minutes", nullable = false)
  private int bookingLeadTimeMinutes = 60;

  @Column(name = "cancellation_window_hours", nullable = false)
  private int cancellationWindowHours = 24;

  @Column(name = "deposit_required", nullable = false)
  private boolean depositRequired;

  @Column(name = "deposit_percent", nullable = false)
  private int depositPercent;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private TenantStatus status = TenantStatus.ACTIVE;

  public ZoneId zoneId() {
    return ZoneId.of(timezone);
  }

  public boolean isActive() {
    return status == TenantStatus.ACTIVE;
  }
}
