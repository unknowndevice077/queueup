package com.queueup.user.dto;

import com.queueup.common.tenant.TenantRole;
import java.util.List;
import java.util.UUID;

public record MeResponse(UserResponse user, List<MembershipSummary> memberships) {

  /** One business the user belongs to, with their role there. */
  public record MembershipSummary(UUID membershipId, UUID tenantId, String tenantSlug, String tenantName,
      String timezone, TenantRole role) {
  }
}
