package com.queueup.booking.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RescheduleBookingRequest(
    @Schema(example = "2026-10-07T14:30:00+08:00") @NotNull OffsetDateTime startsAt,
    @Schema(description = "New staff member; omit to keep the current one") UUID staffId) {
}
