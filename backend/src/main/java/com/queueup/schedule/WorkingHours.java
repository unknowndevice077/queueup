package com.queueup.schedule;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Getter
@Setter
@Entity
@Table(name = "working_hours")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class WorkingHours extends TenantScopedEntity {

  @Column(name = "membership_id", nullable = false, updatable = false)
  private UUID membershipId;

  /** ISO day of week: 1 = Monday ... 7 = Sunday. */
  @Column(name = "day_of_week", nullable = false)
  private short dayOfWeek;

  @Column(name = "start_time", nullable = false)
  private LocalTime startTime;

  @Column(name = "end_time", nullable = false)
  private LocalTime endTime;
}
