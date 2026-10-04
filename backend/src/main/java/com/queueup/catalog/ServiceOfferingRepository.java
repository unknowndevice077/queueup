package com.queueup.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

  Optional<ServiceOffering> findByIdAndTenantId(UUID id, UUID tenantId);

  List<ServiceOffering> findAllByTenantIdOrderByNameAsc(UUID tenantId);

  List<ServiceOffering> findAllByTenantIdAndActiveTrueOrderByNameAsc(UUID tenantId);

  List<ServiceOffering> findAllByTenantIdAndIdIn(UUID tenantId, Collection<UUID> ids);
}
