package com.queueup.schedule;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlackoutRepository extends JpaRepository<Blackout, UUID> {

  Optional<Blackout> findByIdAndTenantId(UUID id, UUID tenantId);

  Page<Blackout> findAllByTenantId(UUID tenantId, Pageable pageable);

  @Query("""
      select b from Blackout b
      where b.tenantId = :tenantId and (b.membershipId is null or b.membershipId = :membershipId)
      """)
  Page<Blackout> findVisibleToStaff(@Param("tenantId") UUID tenantId, @Param("membershipId") UUID membershipId,
      Pageable pageable);

  @Query("""
      select b from Blackout b
      where b.tenantId = :tenantId
        and (b.membershipId is null or b.membershipId in :membershipIds)
        and b.startsAt < :to and b.endsAt > :from
      """)
  List<Blackout> findOverlapping(@Param("tenantId") UUID tenantId,
      @Param("membershipIds") Collection<UUID> membershipIds, @Param("from") Instant from, @Param("to") Instant to);
}
