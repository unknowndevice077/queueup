package com.queueup.booking.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreateBookingRequest(
    @NotNull UUID serviceId,
    @Schema(description = "Preferred staff member; omit to let the system pick anyone available")
    UUID staffId,
    @Schema(example = "2026-10-06T10:00:00+08:00") @NotNull OffsetDateTime startsAt,
    @Size(max = 500) String notes) {
}
