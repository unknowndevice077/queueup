package com.queueup.payment;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, UUID> {

  /**
   * Records the event unless it was already received. Returns 1 for a first delivery, 0 for a duplicate.
   * A concurrent duplicate blocks on the unique index until the first transaction finishes.
   */
  @Modifying
  @Query(value = """
      INSERT INTO webhook_event (id, provider, event_id, event_type, received_at, created_at, updated_at)
      VALUES (gen_random_uuid(), :provider, :eventId, :eventType, now(), now(), now())
      ON CONFLICT (event_id) DO NOTHING
      """, nativeQuery = true)
  int insertIfAbsent(@Param("provider") String provider, @Param("eventId") String eventId,
      @Param("eventType") String eventType);

  Optional<WebhookEvent> findByEventId(String eventId);
}
