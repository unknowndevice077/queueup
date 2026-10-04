package com.queueup.analytics;

import com.queueup.analytics.dto.AnalyticsSummary;
import com.queueup.common.exception.BadRequestException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Aggregations run in SQL with the tenant time zone so "per day" and "per hour" match local business days. */
@Service
public class AnalyticsService {

  private static final int MAX_RANGE_DAYS = 366;
  private static final int TOP_SERVICES = 5;
  private static final DateTimeFormatter CSV_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

  private static final String PER_DAY_SQL = """
      SELECT (b.starts_at AT TIME ZONE :tz)::date AS day,
             count(*) AS total,
             count(*) FILTER (WHERE b.status = 'COMPLETED') AS completed,
             count(*) FILTER (WHERE b.status = 'CANCELLED') AS cancelled,
             count(*) FILTER (WHERE b.status = 'NO_SHOW') AS no_show,
             coalesce(sum(b.price_centavos) FILTER (WHERE b.status = 'COMPLETED'), 0) AS revenue
      FROM booking b
      WHERE b.tenant_id = :tenantId AND b.starts_at >= :from AND b.starts_at < :to
      GROUP BY day
      ORDER BY day
      """;

  private static final String TOP_SERVICES_SQL = """
      SELECT s.id, s.name, count(*) AS bookings,
             coalesce(sum(b.price_centavos) FILTER (WHERE b.status = 'COMPLETED'), 0) AS revenue
      FROM booking b JOIN service_offering s ON s.id = b.service_id
      WHERE b.tenant_id = :tenantId AND b.starts_at >= :from AND b.starts_at < :to AND b.status <> 'CANCELLED'
      GROUP BY s.id, s.name
      ORDER BY bookings DESC, s.name
      LIMIT :limit
      """;

  private static final String BUSIEST_HOURS_SQL = """
      SELECT extract(HOUR FROM b.starts_at AT TIME ZONE :tz)::int AS hour, count(*) AS bookings
      FROM booking b
      WHERE b.tenant_id = :tenantId AND b.starts_at >= :from AND b.starts_at < :to AND b.status <> 'CANCELLED'
      GROUP BY hour
      ORDER BY hour
      """;

  private static final String EXPORT_SQL = """
      SELECT b.id, b.starts_at, s.name AS service, u.full_name AS staff, c.full_name AS customer,
             c.email AS customer_email, c.phone AS customer_phone, b.status, b.price_centavos, b.deposit_centavos
      FROM booking b
      JOIN service_offering s ON s.id = b.service_id
      JOIN membership m ON m.id = b.staff_membership_id
      JOIN app_user u ON u.id = m.user_id
      JOIN app_user c ON c.id = b.customer_id
      WHERE b.tenant_id = :tenantId AND b.starts_at >= :from AND b.starts_at < :to
      ORDER BY b.starts_at
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final TenantAccess tenantAccess;
  private final Clock clock;

  public AnalyticsService(NamedParameterJdbcTemplate jdbc, TenantAccess tenantAccess, Clock clock) {
    this.jdbc = jdbc;
    this.tenantAccess = tenantAccess;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public AnalyticsSummary summary(LocalDate from, LocalDate to) {
    TenantContext context = tenantAccess.requireOwner();
    DateRange range = resolveRange(from, to, context.zone());
    MapSqlParameterSource params = range.params(context.tenantId(), context.zone());

    Map<LocalDate, AnalyticsSummary.DayStats> byDay = jdbc.query(PER_DAY_SQL, params, (rs, i) ->
            new AnalyticsSummary.DayStats(rs.getObject("day", LocalDate.class), rs.getLong("total"),
                rs.getLong("completed"), rs.getLong("cancelled"), rs.getLong("no_show"), rs.getLong("revenue")))
        .stream()
        .collect(Collectors.toMap(AnalyticsSummary.DayStats::date, Function.identity()));
    List<AnalyticsSummary.DayStats> perDay = new ArrayList<>();
    for (LocalDate day = range.from(); !day.isAfter(range.to()); day = day.plusDays(1)) {
      perDay.add(byDay.getOrDefault(day, new AnalyticsSummary.DayStats(day, 0, 0, 0, 0, 0)));
    }

    List<AnalyticsSummary.ServiceStats> topServices = jdbc.query(TOP_SERVICES_SQL,
        params.addValue("limit", TOP_SERVICES), (rs, i) -> new AnalyticsSummary.ServiceStats(
            rs.getObject("id", UUID.class), rs.getString("name"), rs.getLong("bookings"), rs.getLong("revenue")));
    List<AnalyticsSummary.HourStats> busiestHours = jdbc.query(BUSIEST_HOURS_SQL, params, (rs, i) ->
        new AnalyticsSummary.HourStats(rs.getInt("hour"), rs.getLong("bookings")));

    return new AnalyticsSummary(range.from(), range.to(), context.zone().getId(), totals(perDay), perDay,
        topServices, busiestHours);
  }

  @Transactional(readOnly = true)
  public String exportCsv(LocalDate from, LocalDate to) {
    TenantContext context = tenantAccess.requireOwner();
    DateRange range = resolveRange(from, to, context.zone());
    StringBuilder csv = new StringBuilder(
        "booking_id,starts_at_local,service,staff,customer,customer_email,customer_phone,status,price_php,"
            + "deposit_php\n");
    jdbc.query(EXPORT_SQL, range.params(context.tenantId(), context.zone()), rs -> {
      csv.append(String.join(",",
          rs.getString("id"),
          CSV_TIME.format(rs.getTimestamp("starts_at").toInstant().atZone(context.zone())),
          CsvCells.escape(rs.getString("service")),
          CsvCells.escape(rs.getString("staff")),
          CsvCells.escape(rs.getString("customer")),
          CsvCells.escape(rs.getString("customer_email")),
          CsvCells.escape(rs.getString("customer_phone")),
          rs.getString("status"),
          pesos(rs.getLong("price_centavos")),
          pesos(rs.getLong("deposit_centavos")))).append('\n');
    });
    return csv.toString();
  }

  private DateRange resolveRange(LocalDate from, LocalDate to, ZoneId zone) {
    LocalDate end = to != null ? to : LocalDate.now(clock.withZone(zone));
    LocalDate start = from != null ? from : end.minusDays(29);
    if (start.isAfter(end)) {
      throw new BadRequestException("from", "must be on or before 'to'");
    }
    if (ChronoUnit.DAYS.between(start, end) >= MAX_RANGE_DAYS) {
      throw new BadRequestException("from", "range must be at most " + MAX_RANGE_DAYS + " days");
    }
    return new DateRange(start, end);
  }

  private static AnalyticsSummary.Totals totals(List<AnalyticsSummary.DayStats> days) {
    long total = 0;
    long completed = 0;
    long cancelled = 0;
    long noShow = 0;
    long revenue = 0;
    for (AnalyticsSummary.DayStats day : days) {
      total += day.total();
      completed += day.completed();
      cancelled += day.cancelled();
      noShow += day.noShow();
      revenue += day.revenueCentavos();
    }
    long attendedOrMissed = completed + noShow;
    double noShowRate = attendedOrMissed == 0 ? 0.0
        : BigDecimal.valueOf(noShow).divide(BigDecimal.valueOf(attendedOrMissed), 4, RoundingMode.HALF_UP)
            .doubleValue();
    return new AnalyticsSummary.Totals(total, completed, cancelled, noShow, noShowRate, revenue);
  }

  private static String pesos(long centavos) {
    return BigDecimal.valueOf(centavos, 2).toPlainString();
  }

  /** Inclusive tenant-local date range. */
  private record DateRange(LocalDate from, LocalDate to) {

    MapSqlParameterSource params(UUID tenantId, ZoneId zone) {
      return new MapSqlParameterSource()
          .addValue("tenantId", tenantId)
          .addValue("tz", zone.getId())
          .addValue("from", Timestamp.from(from.atStartOfDay(zone).toInstant()))
          .addValue("to", Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant()));
    }
  }
}
