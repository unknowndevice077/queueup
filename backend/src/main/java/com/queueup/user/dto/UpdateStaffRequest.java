package com.queueup.user.dto;

import com.queueup.common.tenant.TenantRole;

/** PATCH semantics: null fields are left unchanged. */
public record UpdateStaffRequest(TenantRole role, Boolean active) {
}
