package com.queueup.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CancellationPolicyTest {

  private static final Instant START = Instant.parse("2026-10-20T02:00:00Z");

  @Test
  void allowsChangesWellBeforeTheWindow() {
    assertThat(CancellationPolicy.customerMayChange(START, START.minus(Duration.ofHours(48)), 24)).isTrue();
  }

  @Test
  void allowsChangesExactlyAtTheDeadline() {
    assertThat(CancellationPolicy.customerMayChange(START, START.minus(Duration.ofHours(24)), 24)).isTrue();
  }

  @Test
  void rejectsChangesInsideTheWindow() {
    assertThat(CancellationPolicy.customerMayChange(START, START.minus(Duration.ofHours(23)), 24)).isFalse();
  }

  @Test
  void zeroWindowAllowsChangesUntilTheStart() {
    assertThat(CancellationPolicy.customerMayChange(START, START, 0)).isTrue();
    assertThat(CancellationPolicy.customerMayChange(START, START.plusSeconds(1), 0)).isFalse();
  }

  @Test
  void deadlineIsStartMinusWindow() {
    assertThat(CancellationPolicy.customerDeadline(START, 24)).isEqualTo(Instant.parse("2026-10-19T02:00:00Z"));
  }
}
