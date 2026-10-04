package com.queueup.schedule;

import com.queueup.schedule.dto.WorkingHoursRange;
import java.util.List;

/** Exposes the package-private schedule validation to tests in other packages. */
public final class WorkingHoursValidationProbe {

  private WorkingHoursValidationProbe() {
  }

  public static void validate(List<WorkingHoursRange> ranges) {
    WorkingHoursService.validate(ranges);
  }
}
