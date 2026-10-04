package com.queueup.booking.slot;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Everything the slot engine needs for one staff member on one date. The engine is pure: callers load
 * working hours, blackouts and bookings, the engine does the arithmetic.
 *
 * @param date tenant-local calendar date
 * @param zone tenant time zone
 * @param workingRanges local working ranges for that weekday (several ranges model breaks)
 * @param busy intervals already taken: blackouts and blocking bookings (whose end already includes buffer)
 * @param durationMinutes service duration
 * @param bufferMinutes clean-up buffer after the service
 * @param earliestStart nothing may start before this instant (now + booking lead time)
 * @param stepMinutes slot granularity, aligned to the local clock (e.g. :00, :15, :30, :45)
 */
public record SlotQuery(
    LocalDate date,
    ZoneId zone,
    List<LocalTimeRange> workingRanges,
    List<TimeInterval> busy,
    int durationMinutes,
    int bufferMinutes,
    Instant earliestStart,
    int stepMinutes) {

  /** A local wall-clock range within one day. */
  public record LocalTimeRange(LocalTime start, LocalTime end) {
  }
}
