package com.queueup.user.dto;

import com.queueup.schedule.dto.WorkingHoursRange;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The complete weekly schedule; it replaces whatever was stored before. */
public record WorkingHoursRequest(@NotNull @Size(max = 50) List<@Valid @NotNull WorkingHoursRange> ranges) {
}
