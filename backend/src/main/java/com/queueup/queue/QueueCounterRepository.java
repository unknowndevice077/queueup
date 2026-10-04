package com.queueup.queue;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Allocates per-tenant, per-day ticket numbers atomically in a single upsert statement. */
@Repository
public class QueueCounterRepository {

  private static final String NEXT_NUMBER_SQL = """
      INSERT INTO queue_counter (tenant_id, queue_date, last_number)
      VALUES (:tenantId, :queueDate, 1)
      ON CONFLICT (tenant_id, queue_date)
      DO UPDATE SET last_number = queue_counter.last_number + 1
      RETURNING last_number
      """;

  private final NamedParameterJdbcTemplate jdbc;

  public QueueCounterRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public int nextNumber(UUID tenantId, LocalDate queueDate) {
    Integer next = jdbc.queryForObject(NEXT_NUMBER_SQL,
        Map.of("tenantId", tenantId, "queueDate", queueDate), Integer.class);
    if (next == null) {
      throw new IllegalStateException("Ticket counter returned no value");
    }
    return next;
  }
}
