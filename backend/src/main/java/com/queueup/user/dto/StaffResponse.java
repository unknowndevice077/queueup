package com.queueup.user.dto;

import com.queueup.common.tenant.TenantRole;
import com.queueup.schedule.dto.WorkingHoursRange;
import java.util.List;
import java.util.UUID;

public record StaffResponse(
    UUID id,
    UUID userId,
    String fullName,
    String email,
    String phone,
    TenantRole role,
    boolean active,
    List<UUID> serviceIds,
    List<WorkingHoursRange> workingHours) {
}
