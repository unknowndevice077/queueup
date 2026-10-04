package com.queueup.booking.slot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SlotEngineTest {

  private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
  private static final LocalDate MONDAY = LocalDate.of(2026, 10, 12);
  private static final Instant LONG_AGO = Instant.parse("2000-01-01T00:00:00Z");

  private static SlotQuery.LocalTimeRange range(int startHour, int startMinute, int endHour, int endMinute) {
    return new SlotQuery.LocalTimeRange(LocalTime.of(startHour, startMinute), LocalTime.of(endHour, endMinute));
  }

  private static TimeInterval busy(int startHour, int startMinute, int endHour, int endMinute) {
    return new TimeInterval(at(startHour, startMinute), at(endHour, endMinute));
  }

  private static Instant at(int hour, int minute) {
    return MONDAY.atTime(hour, minute).atZone(MANILA).toInstant();
  }

  private static SlotQuery query(List<SlotQuery.LocalTimeRange> ranges, List<TimeInterval> busy, int duration,
      int buffer, Instant earliest) {
    return new SlotQuery(MONDAY, MANILA, ranges, busy, duration, buffer, earliest, 15);
  }

  private static List<LocalTime> localTimes(List<ZonedDateTime> slots) {
    return slots.stream().map(ZonedDateTime::toLocalTime).toList();
  }

  @Test
  @DisplayName("generates 15-minute steps where the whole service fits in a single working range")
  void singleRange() {
    List<ZonedDateTime> slots = SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(), 30, 0, LONG_AGO));

    assertThat(slots).hasSize(11);
    assertThat(localTimes(slots)).startsWith(LocalTime.of(9, 0), LocalTime.of(9, 15))
        .endsWith(LocalTime.of(11, 30));
  }

  @Test
  @DisplayName("never places a slot across a lunch break between two ranges")
  void lunchBreak() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0), range(13, 0, 17, 0)), List.of(), 45, 0, LONG_AGO)));

    assertThat(times).contains(LocalTime.of(11, 15), LocalTime.of(13, 0))
        .doesNotContain(LocalTime.of(11, 30), LocalTime.of(12, 0), LocalTime.of(12, 30));
  }

  @Test
  @DisplayName("requires room for duration plus buffer")
  void bufferReducesLastSlot() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(), 30, 15, LONG_AGO)));

    assertThat(times).last().isEqualTo(LocalTime.of(11, 15));
  }

  @Test
  @DisplayName("subtracts existing bookings, including their buffer")
  void existingBookingBlocksTime() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(busy(10, 0, 10, 45)), 30, 0, LONG_AGO)));

    assertThat(times).contains(LocalTime.of(9, 30), LocalTime.of(10, 45))
        .doesNotContain(LocalTime.of(9, 45), LocalTime.of(10, 0), LocalTime.of(10, 30));
  }

  @Test
  @DisplayName("back-to-back bookings are allowed at the exact boundaries")
  void adjacentBookings() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(busy(10, 0, 10, 30)), 30, 0, LONG_AGO)));

    assertThat(times).contains(LocalTime.of(9, 30), LocalTime.of(10, 30));
  }

  @Test
  @DisplayName("subtracts a staff blackout inside the day")
  void blackoutRemovesSlots() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 17, 0)), List.of(busy(13, 0, 15, 0)), 30, 0, LONG_AGO)));

    assertThat(times).contains(LocalTime.of(12, 30), LocalTime.of(15, 0))
        .noneMatch(t -> t.isAfter(LocalTime.of(12, 30)) && t.isBefore(LocalTime.of(15, 0)));
  }

  @Test
  @DisplayName("a blackout covering the whole day leaves nothing")
  void fullDayBlackout() {
    TimeInterval wholeDay = new TimeInterval(MONDAY.atStartOfDay(MANILA).toInstant(),
        MONDAY.plusDays(1).atStartOfDay(MANILA).toInstant());

    assertThat(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 17, 0)), List.of(wholeDay), 30, 0, LONG_AGO))).isEmpty();
  }

  @Test
  @DisplayName("no working hours means no slots")
  void noWorkingHours() {
    assertThat(SlotEngine.availableStarts(query(List.of(), List.of(), 30, 0, LONG_AGO))).isEmpty();
  }

  @Test
  @DisplayName("a date in the past yields nothing because every start is before now")
  void pastDate() {
    Instant now = MONDAY.plusDays(1).atStartOfDay(MANILA).toInstant();

    assertThat(SlotEngine.availableStarts(query(List.of(range(9, 0, 17, 0)), List.of(), 30, 0, now))).isEmpty();
  }

  @Test
  @DisplayName("drops slots earlier than now plus lead time")
  void leadTime() {
    Instant earliest = at(10, 20);

    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(), 30, 0, earliest)));

    assertThat(times).first().isEqualTo(LocalTime.of(10, 30));
  }

  @Test
  @DisplayName("a service longer than every range has no slots")
  void serviceLongerThanRange() {
    assertThat(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 10, 0)), List.of(), 90, 0, LONG_AGO))).isEmpty();
  }

  @Test
  @DisplayName("a slot may end exactly when the working range ends")
  void fitsExactlyAtEnd() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 17, 0)), List.of(), 30, 0, LONG_AGO)));

    assertThat(times).last().isEqualTo(LocalTime.of(16, 30));
  }

  @Test
  @DisplayName("slots stay aligned to the quarter hour after an oddly timed booking")
  void alignsToClock() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(busy(9, 0, 10, 20)), 30, 0, LONG_AGO)));

    assertThat(times).first().isEqualTo(LocalTime.of(10, 30));
    assertThat(times).allMatch(t -> t.getMinute() % 15 == 0);
  }

  @Test
  @DisplayName("a booking that started before the range only trims its beginning")
  void bookingOverlappingRangeStart() {
    List<LocalTime> times = localTimes(SlotEngine.availableStarts(
        query(List.of(range(9, 0, 12, 0)), List.of(busy(8, 30, 9, 30)), 30, 0, LONG_AGO)));

    assertThat(times).first().isEqualTo(LocalTime.of(9, 30));
  }

  @Test
  @DisplayName("returns tenant-local times carrying the +08:00 offset")
  void returnsZonedTimes() {
    List<ZonedDateTime> slots = SlotEngine.availableStarts(
        query(List.of(range(9, 0, 10, 0)), List.of(), 30, 0, LONG_AGO));

    assertThat(slots).allMatch(slot -> slot.getZone().equals(MANILA))
        .allMatch(slot -> slot.getOffset().getTotalSeconds() == 8 * 3600);
    assertThat(slots.getFirst().toInstant()).isEqualTo(Instant.parse("2026-10-12T01:00:00Z"));
  }

  @Test
  @DisplayName("is DST-safe: on a spring-forward day it counts real minutes and never duplicates a start")
  void daylightSavingGap() {
    ZoneId newYork = ZoneId.of("America/New_York");
    LocalDate springForward = LocalDate.of(2026, 3, 8);
    SlotQuery query = new SlotQuery(springForward, newYork, List.of(range(1, 0, 4, 0)), List.of(), 30, 0,
        LONG_AGO, 15);

    List<ZonedDateTime> slots = SlotEngine.availableStarts(query);

    // 01:00-04:00 local is only two real hours that day: (120 - 30) / 15 + 1 = 7 starts.
    assertThat(slots).hasSize(7).doesNotHaveDuplicates();
    assertThat(slots).allMatch(slot -> !slot.toInstant().plus(Duration.ofMinutes(30))
        .isAfter(springForward.atTime(4, 0).atZone(newYork).toInstant()));
  }

  @Test
  @DisplayName("rejects non-positive step or duration")
  void rejectsInvalidInput() {
    assertThatThrownBy(() -> SlotEngine.availableStarts(new SlotQuery(MONDAY, MANILA, List.of(), List.of(), 0, 0,
        LONG_AGO, 15))).isInstanceOf(IllegalArgumentException.class);
  }
}
