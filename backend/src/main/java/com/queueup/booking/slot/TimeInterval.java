package com.queueup.booking.slot;

import java.time.Instant;

/** Half-open interval [start, end) on the UTC timeline. */
public record TimeInterval(Instant start, Instant end) {

  public TimeInterval {
    if (!start.isBefore(end)) {
      throw new IllegalArgumentException("start must be before end");
    }
  }

  public boolean contains(Instant from, Instant to) {
    return !from.isBefore(start) && !to.isAfter(end);
  }

  public boolean overlaps(TimeInterval other) {
    return start.isBefore(other.end) && other.start.isBefore(end);
  }
}
