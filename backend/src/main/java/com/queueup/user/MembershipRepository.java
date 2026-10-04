package com.queueup.user;

import com.queueup.common.tenant.TenantRole;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

  Optional<Membership> findByTenantIdAndUserId(UUID tenantId, UUID userId);

  @Query("select m from Membership m join fetch m.user where m.id = :id and m.tenantId = :tenantId")
  Optional<Membership> findWithUserByIdAndTenantId(@Param("id") UUID id, @Param("tenantId") UUID tenantId);

  @Query("""
      select m from Membership m join fetch m.user u
      where m.tenantId = :tenantId
      order by m.role desc, u.fullName asc
      """)
  List<Membership> findAllWithUserByTenantId(@Param("tenantId") UUID tenantId);

  @Query("""
      select m from Membership m join fetch m.user u
      where m.tenantId = :tenantId and m.id in :ids and m.active = true
      order by u.fullName asc
      """)
  List<Membership> findActiveWithUserByIds(@Param("tenantId") UUID tenantId, @Param("ids") Collection<UUID> ids);

  @Query("select m from Membership m where m.user.id = :userId and m.active = true")
  List<Membership> findActiveByUserId(@Param("userId") UUID userId);

  long countByTenantIdAndRoleAndActiveTrue(UUID tenantId, TenantRole role);
}
