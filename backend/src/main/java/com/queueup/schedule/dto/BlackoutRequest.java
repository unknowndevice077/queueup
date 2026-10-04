package com.queueup.schedule.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BlackoutRequest(
    @Schema(description = "Staff membership id; omit for a business-wide closure (OWNER only)")
    UUID membershipId,
    @Schema(example = "2026-12-24T13:00:00+08:00") @NotNull OffsetDateTime startsAt,
    @Schema(example = "2026-12-26T00:00:00+08:00") @NotNull OffsetDateTime endsAt,
    @Size(max = 255) String reason) {
}
