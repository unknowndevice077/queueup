package com.queueup.catalog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ServiceRequest(
    @NotBlank @Size(max = 120) String name,
    @Size(max = 1000) String description,
    @NotNull @Min(5) @Max(480) Integer durationMinutes,
    @Min(0) @Max(240) Integer bufferMinutes,
    @NotNull @Min(0) @Max(100_000_000) Long priceCentavos,
    Boolean active) {
}
