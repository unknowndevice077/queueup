package com.queueup.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Base class for every tenant-owned table. Subclasses must also carry
 * {@code @Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)} so the
 * per-request Hibernate filter applies to them.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class TenantScopedEntity extends BaseEntity {

  @Column(name = "tenant_id", nullable = false, updatable = false)
  private UUID tenantId;
}
