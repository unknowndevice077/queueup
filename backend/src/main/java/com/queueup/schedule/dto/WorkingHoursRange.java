package com.queueup.schedule.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

/** One working range on a weekday in tenant-local time. Several ranges per day model breaks such as lunch. */
public record WorkingHoursRange(
    @Schema(description = "ISO day of week, 1 = Monday ... 7 = Sunday", example = "1")
    @NotNull @Min(1) @Max(7) Integer dayOfWeek,
    @Schema(type = "string", example = "09:00") @NotNull LocalTime startTime,
    @Schema(type = "string", example = "12:00") @NotNull LocalTime endTime) {
}
