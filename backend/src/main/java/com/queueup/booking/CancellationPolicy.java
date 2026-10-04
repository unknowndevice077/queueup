package com.queueup.booking;

import java.time.Duration;
import java.time.Instant;

/** Customers may cancel or reschedule only until {@code cancellationWindowHours} before the start. */
public final class CancellationPolicy {

  private CancellationPolicy() {
  }

  public static Instant customerDeadline(Instant startsAt, int cancellationWindowHours) {
    return startsAt.minus(Duration.ofHours(cancellationWindowHours));
  }

  public static boolean customerMayChange(Instant startsAt, Instant now, int cancellationWindowHours) {
    return !now.isAfter(customerDeadline(startsAt, cancellationWindowHours));
  }
}
