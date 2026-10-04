package com.queueup.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.queueup.common.exception.BadRequestException;
import com.queueup.common.tenant.TenantRole;
import com.queueup.schedule.dto.WorkingHoursRange;
import com.queueup.schedule.WorkingHoursValidationProbe;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class SmallUnitsTest {

  @Test
  void formatsCentavosAsPesos() {
    assertThat(MoneyFormat.peso(0)).isEqualTo("₱0.00");
    assertThat(MoneyFormat.peso(25_000)).isEqualTo("₱250.00");
    assertThat(MoneyFormat.peso(123_456_78)).isEqualTo("₱123,456.78");
  }

  @Test
  void ownerOutranksStaff() {
    assertThat(TenantRole.OWNER.atLeast(TenantRole.STAFF)).isTrue();
    assertThat(TenantRole.STAFF.atLeast(TenantRole.OWNER)).isFalse();
  }

  @Test
  void weeklyScheduleRejectsOverlappingRangesOnTheSameDay() {
    List<WorkingHoursRange> overlapping = List.of(
        new WorkingHoursRange(1, LocalTime.of(9, 0), LocalTime.of(12, 0)),
        new WorkingHoursRange(1, LocalTime.of(11, 0), LocalTime.of(15, 0)));

    assertThatThrownBy(() -> WorkingHoursValidationProbe.validate(overlapping))
        .isInstanceOf(BadRequestException.class).hasMessageContaining("overlap");
  }

  @Test
  void weeklyScheduleAcceptsLunchBreaksAndRejectsInvertedRanges() {
    WorkingHoursValidationProbe.validate(List.of(
        new WorkingHoursRange(1, LocalTime.of(9, 0), LocalTime.of(12, 0)),
        new WorkingHoursRange(1, LocalTime.of(13, 0), LocalTime.of(17, 0)),
        new WorkingHoursRange(2, LocalTime.of(9, 0), LocalTime.of(12, 0))));

    assertThatThrownBy(() -> WorkingHoursValidationProbe.validate(List.of(
        new WorkingHoursRange(3, LocalTime.of(12, 0), LocalTime.of(9, 0)))))
        .isInstanceOf(BadRequestException.class);
  }
}
