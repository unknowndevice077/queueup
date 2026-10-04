package com.queueup.tenant.dto;

import com.queueup.tenant.TenantStatus;
import java.util.UUID;

public record TenantSettingsResponse(
    UUID id,
    String name,
    String slug,
    String timezone,
    String currency,
    String contactEmail,
    String contactPhone,
    String address,
    int bookingLeadTimeMinutes,
    int cancellationWindowHours,
    boolean depositRequired,
    int depositPercent,
    TenantStatus status) {
}
