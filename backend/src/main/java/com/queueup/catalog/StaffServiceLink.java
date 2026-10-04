package com.queueup.catalog;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

/** Which staff member (membership) can perform which service. Maps the staff_service table. */
@Getter
@Setter
@Entity
@Table(name = "staff_service")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class StaffServiceLink extends TenantScopedEntity {

  @Column(name = "membership_id", nullable = false, updatable = false)
  private UUID membershipId;

  @Column(name = "service_id", nullable = false, updatable = false)
  private UUID serviceId;
}
