package com.queueup.catalog;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffServiceLinkRepository extends JpaRepository<StaffServiceLink, UUID> {

  List<StaffServiceLink> findAllByTenantId(UUID tenantId);

  List<StaffServiceLink> findAllByTenantIdAndMembershipId(UUID tenantId, UUID membershipId);

  @Query("select l.membershipId from StaffServiceLink l where l.tenantId = :tenantId and l.serviceId = :serviceId")
  List<UUID> findMembershipIdsByService(@Param("tenantId") UUID tenantId, @Param("serviceId") UUID serviceId);

  boolean existsByTenantIdAndMembershipIdAndServiceId(UUID tenantId, UUID membershipId, UUID serviceId);

  @Modifying
  @Query("delete from StaffServiceLink l where l.tenantId = :tenantId and l.membershipId = :membershipId")
  void deleteAllForMembership(@Param("tenantId") UUID tenantId, @Param("membershipId") UUID membershipId);
}
