package com.queueup.waitlist;

import com.queueup.common.CsvCells;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores waitlist signups (one per email per list) and exports them for follow-up. */
@Service
public class WaitlistService {

  private static final Logger log = LoggerFactory.getLogger(WaitlistService.class);
  private static final String CSV_HEADER =
      "joined_at,kind,full_name,email,phone,country,family_location,relation,services,frequency,clinic_name,source";

  private final JdbcTemplate jdbc;
  private final Clock clock;

  public WaitlistService(JdbcTemplate jdbc, Clock clock) {
    this.jdbc = jdbc;
    this.clock = clock;
  }

  public record Position(int position, int total) {
  }

  @Transactional
  public Position join(WaitlistRequest request) {
    String services = request.services() == null ? null
        : request.services().stream().map(String::trim).filter(s -> !s.isEmpty()).distinct()
            .collect(Collectors.joining(";"));
    UUID id = jdbc.queryForObject("""
        INSERT INTO waitlist_signup (kind, full_name, email, phone, country, family_location, relation, services,
                                     frequency, clinic_name, source, consented_at)
        VALUES (?, ?, lower(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (kind, lower(email)) DO UPDATE SET
            full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, country = EXCLUDED.country,
            family_location = EXCLUDED.family_location, relation = EXCLUDED.relation,
            services = EXCLUDED.services, frequency = EXCLUDED.frequency, clinic_name = EXCLUDED.clinic_name,
            source = COALESCE(waitlist_signup.source, EXCLUDED.source), updated_at = now()
        RETURNING id
        """, UUID.class,
        request.kind().name(), request.fullName().trim(), request.email().trim(), blankToNull(request.phone()),
        blankToNull(request.country()), blankToNull(request.familyLocation()), blankToNull(request.relation()),
        blankToNull(services), blankToNull(request.frequency()), blankToNull(request.clinicName()),
        blankToNull(request.source()), Timestamp.from(clock.instant()));

    Position position = jdbc.queryForObject("""
        SELECT (SELECT count(*) FROM waitlist_signup w
                WHERE w.kind = s.kind AND (w.created_at, w.id) <= (s.created_at, s.id)) AS position,
               (SELECT count(*) FROM waitlist_signup w WHERE w.kind = s.kind) AS total
        FROM waitlist_signup s WHERE s.id = ?
        """, (rs, n) -> new Position(rs.getInt("position"), rs.getInt("total")), id);
    log.info("Waitlist signup kind={} source={} position={}", request.kind(), request.source(),
        position == null ? null : position.position());
    return position;
  }

  @Transactional(readOnly = true)
  public String exportCsv() {
    List<String> rows = jdbc.query("""
        SELECT created_at, kind, full_name, email, phone, country, family_location, relation, services, frequency,
               clinic_name, source
        FROM waitlist_signup ORDER BY kind, created_at
        """, (rs, n) -> String.join(",",
        rs.getTimestamp("created_at").toInstant().toString(),
        rs.getString("kind"),
        CsvCells.escape(rs.getString("full_name")),
        CsvCells.escape(rs.getString("email")),
        CsvCells.escape(rs.getString("phone")),
        CsvCells.escape(rs.getString("country")),
        CsvCells.escape(rs.getString("family_location")),
        CsvCells.escape(rs.getString("relation")),
        CsvCells.escape(rs.getString("services")),
        CsvCells.escape(rs.getString("frequency")),
        CsvCells.escape(rs.getString("clinic_name")),
        CsvCells.escape(rs.getString("source"))));
    return CSV_HEADER + "\n" + String.join("\n", rows) + (rows.isEmpty() ? "" : "\n");
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
