package com.queueup.common.tenant;

import com.queueup.common.exception.ForbiddenException;
import com.queueup.common.exception.NotFoundException;
import org.springframework.stereotype.Component;

/**
 * Authorization checks against the caller membership in the current tenant.
 * Non-members get 404 (we do not reveal that tenant-private resources exist);
 * members with an insufficient role get 403.
 */
@Component
public class TenantAccess {

  public TenantContext requireMember() {
    return requireRole(TenantRole.STAFF);
  }

  public TenantContext requireOwner() {
    return requireRole(TenantRole.OWNER);
  }

  public TenantContext requireRole(TenantRole required) {
    TenantContext context = TenantContext.require();
    if (!context.isMember()) {
      throw new NotFoundException("Resource not found");
    }
    if (!context.role().atLeast(required)) {
      throw new ForbiddenException("This action requires the " + required + " role");
    }
    return context;
  }

  public TenantContext current() {
    return TenantContext.require();
  }
}
