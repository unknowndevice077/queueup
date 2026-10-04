package com.queueup.catalog;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Getter
@Setter
@Entity
@Table(name = "service_offering")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class ServiceOffering extends TenantScopedEntity {

  @Column(nullable = false, length = 120)
  private String name;

  @Column(length = 1000)
  private String description;

  @Column(name = "duration_minutes", nullable = false)
  private int durationMinutes;

  @Column(name = "buffer_minutes", nullable = false)
  private int bufferMinutes;

  @Column(name = "price_centavos", nullable = false)
  private long priceCentavos;

  @Column(nullable = false)
  private boolean active = true;

  /** Minutes a booking of this service occupies the staff member, including the clean-up buffer. */
  public int blockMinutes() {
    return durationMinutes + bufferMinutes;
  }
}
