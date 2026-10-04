package com.queueup.analytics.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Dashboard metrics for a tenant-local date range (inclusive). Money in centavos. */
public record AnalyticsSummary(
    LocalDate from,
    LocalDate to,
    String timezone,
    Totals totals,
    List<DayStats> bookingsPerDay,
    List<ServiceStats> topServices,
    List<HourStats> busiestHours) {

  /** Totals across the range. noShowRate = no-shows / (completed + no-shows). */
  public record Totals(long bookings, long completed, long cancelled, long noShow, double noShowRate,
      long revenueCentavos) {
  }

  /** One calendar day. Revenue counts completed bookings. */
  public record DayStats(LocalDate date, long total, long completed, long cancelled, long noShow,
      long revenueCentavos) {
  }

  /** A service ranked by number of non-cancelled bookings. */
  public record ServiceStats(UUID serviceId, String name, long bookings, long revenueCentavos) {
  }

  /** Non-cancelled bookings starting in a given local hour (0-23). */
  public record HourStats(int hour, long bookings) {
  }
}
