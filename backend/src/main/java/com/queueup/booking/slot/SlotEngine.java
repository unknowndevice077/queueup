package com.queueup.booking.slot;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Computes bookable start times for one staff member on one date.
 *
 * <ol>
 *   <li>Turn the local working ranges into UTC intervals using {@link ZonedDateTime} (DST-safe).</li>
 *   <li>Subtract busy intervals (blackouts and blocking bookings).</li>
 *   <li>Walk the local clock in fixed steps; keep starts where start + duration + buffer fits in free time.</li>
 *   <li>Drop starts before {@code earliestStart} (now + lead time); past dates therefore yield nothing.</li>
 * </ol>
 */
public final class SlotEngine {

  private static final int MINUTES_PER_DAY = 24 * 60;

  private SlotEngine() {
  }

  public static List<ZonedDateTime> availableStarts(SlotQuery query) {
    if (query.stepMinutes() <= 0 || query.durationMinutes() <= 0) {
      throw new IllegalArgumentException("step and duration must be positive");
    }
    List<TimeInterval> free = freeIntervals(query);
    if (free.isEmpty()) {
      return List.of();
    }
    Duration block = Duration.ofMinutes((long) query.durationMinutes() + query.bufferMinutes());
    Set<Instant> starts = new LinkedHashSet<>();
    for (int minute = 0; minute < MINUTES_PER_DAY; minute += query.stepMinutes()) {
      Instant start = ZonedDateTime.of(query.date(), LocalTime.MIDNIGHT.plusMinutes(minute), query.zone())
          .toInstant();
      Instant end = start.plus(block);
      if (start.isBefore(query.earliestStart())) {
        continue;
      }
      if (free.stream().anyMatch(interval -> interval.contains(start, end))) {
        starts.add(start);
      }
    }
    return starts.stream().sorted().map(instant -> instant.atZone(query.zone())).toList();
  }

  static List<TimeInterval> freeIntervals(SlotQuery query) {
    List<TimeInterval> free = new ArrayList<>();
    for (SlotQuery.LocalTimeRange range : query.workingRanges()) {
      Instant start = ZonedDateTime.of(query.date(), range.start(), query.zone()).toInstant();
      Instant end = ZonedDateTime.of(query.date(), range.end(), query.zone()).toInstant();
      if (start.isBefore(end)) {
        free.add(new TimeInterval(start, end));
      }
    }
    List<TimeInterval> busy = query.busy().stream().sorted(Comparator.comparing(TimeInterval::start)).toList();
    for (TimeInterval taken : busy) {
      free = subtract(free, taken);
    }
    return free;
  }

  private static List<TimeInterval> subtract(List<TimeInterval> free, TimeInterval taken) {
    List<TimeInterval> result = new ArrayList<>();
    for (TimeInterval interval : free) {
      if (!interval.overlaps(taken)) {
        result.add(interval);
        continue;
      }
      if (interval.start().isBefore(taken.start())) {
        result.add(new TimeInterval(interval.start(), taken.start()));
      }
      if (taken.end().isBefore(interval.end())) {
        result.add(new TimeInterval(taken.end(), interval.end()));
      }
    }
    return result;
  }
}
