package com.queueup.tenant.dto;

import com.queueup.common.validation.ValidTimeZone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTenantRequest(
    @NotBlank @Size(max = 120) String name,
    @NotBlank
    @Size(min = 3, max = 60)
    @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "must be lowercase letters, numbers and single dashes")
    String slug,
    @ValidTimeZone String timezone,
    @Email @Size(max = 254) String contactEmail,
    @Size(max = 32) String contactPhone,
    @Size(max = 255) String address) {
}
