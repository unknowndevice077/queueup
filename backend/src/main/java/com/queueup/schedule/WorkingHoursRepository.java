package com.queueup.schedule;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkingHoursRepository extends JpaRepository<WorkingHours, UUID> {

  List<WorkingHours> findAllByTenantIdOrderByDayOfWeekAscStartTimeAsc(UUID tenantId);

  List<WorkingHours> findAllByTenantIdAndMembershipIdOrderByDayOfWeekAscStartTimeAsc(UUID tenantId,
      UUID membershipId);

  List<WorkingHours> findAllByTenantIdAndMembershipIdInAndDayOfWeek(UUID tenantId, Collection<UUID> membershipIds,
      short dayOfWeek);

  @Modifying
  @Query("delete from WorkingHours w where w.tenantId = :tenantId and w.membershipId = :membershipId")
  void deleteAllForMembership(@Param("tenantId") UUID tenantId, @Param("membershipId") UUID membershipId);
}
