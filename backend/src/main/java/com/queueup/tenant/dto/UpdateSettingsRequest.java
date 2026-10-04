package com.queueup.tenant.dto;

import com.queueup.common.validation.ValidTimeZone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** PATCH semantics: null fields are left unchanged. */
public record UpdateSettingsRequest(
    @Size(min = 1, max = 120) String name,
    @ValidTimeZone String timezone,
    @Email @Size(max = 254) String contactEmail,
    @Size(max = 32) String contactPhone,
    @Size(max = 255) String address,
    @Min(0) @Max(10080) Integer bookingLeadTimeMinutes,
    @Min(0) @Max(720) Integer cancellationWindowHours,
    Boolean depositRequired,
    @Min(0) @Max(100) Integer depositPercent) {
}
