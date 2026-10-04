package com.queueup.booking;

import java.util.EnumSet;
import java.util.Set;

public enum BookingStatus {
  PENDING_PAYMENT,
  CONFIRMED,
  CANCELLED,
  COMPLETED,
  NO_SHOW;

  /** Statuses that hold a slot on the staff calendar (mirrors the DB exclusion constraint). */
  public static final Set<BookingStatus> BLOCKING = EnumSet.of(PENDING_PAYMENT, CONFIRMED);

  public boolean isBlocking() {
    return BLOCKING.contains(this);
  }
}
