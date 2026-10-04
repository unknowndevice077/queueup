package com.queueup.common.tenant;

/** Role of a member inside one tenant. Declared in order of increasing privilege. */
public enum TenantRole {
  STAFF,
  OWNER;

  public boolean atLeast(TenantRole required) {
    return this.ordinal() >= required.ordinal();
  }
}
