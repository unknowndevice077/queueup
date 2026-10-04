package com.queueup.common.persistence;

public final class TenantFilter {

  public static final String NAME = "tenantFilter";
  public static final String PARAM = "tenantId";
  public static final String CONDITION = "tenant_id = :tenantId";

  private TenantFilter() {
  }
}
