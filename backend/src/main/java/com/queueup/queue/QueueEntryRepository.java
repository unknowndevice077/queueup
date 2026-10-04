package com.queueup.queue;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QueueEntryRepository extends JpaRepository<QueueEntry, UUID> {

  Optional<QueueEntry> findByIdAndTenantId(UUID id, UUID tenantId);

  @Query("""
      select q from QueueEntry q left join fetch q.service
      where q.tenantId = :tenantId and q.queueDate = :date
      order by q.ticketNumber asc
      """)
  List<QueueEntry> findAllForDay(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);

  /**
   * Claims the lowest waiting ticket. SKIP LOCKED lets two staff members press "call next" at the same time
   * without both getting the same customer.
   */
  @Query(value = """
      SELECT * FROM queue_entry
      WHERE tenant_id = :tenantId AND queue_date = :date AND status = 'WAITING'
      ORDER BY ticket_number
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      """, nativeQuery = true)
  Optional<QueueEntry> claimNextWaiting(@Param("tenantId") UUID tenantId, @Param("date") LocalDate date);
}
