package com.queueup.catalog;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.catalog.dto.ServiceRequest;
import com.queueup.catalog.dto.ServiceResponse;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServiceOfferingService {

  private static final String ENTITY = "SERVICE";

  private final ServiceOfferingRepository repository;
  private final ServiceMapper mapper;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;

  public ServiceOfferingService(ServiceOfferingRepository repository, ServiceMapper mapper,
      TenantAccess tenantAccess, AuditService auditService) {
    this.repository = repository;
    this.mapper = mapper;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
  }

  @Transactional(readOnly = true)
  public List<ServiceResponse> listAll() {
    UUID tenantId = tenantAccess.requireMember().tenantId();
    return repository.findAllByTenantIdOrderByNameAsc(tenantId).stream().map(mapper::toResponse).toList();
  }

  @Transactional(readOnly = true)
  public List<ServiceResponse> listActivePublic() {
    UUID tenantId = TenantContext.require().tenantId();
    return repository.findAllByTenantIdAndActiveTrueOrderByNameAsc(tenantId).stream()
        .map(mapper::toResponse)
        .toList();
  }

  @Transactional(readOnly = true)
  public ServiceResponse get(UUID id) {
    UUID tenantId = tenantAccess.requireMember().tenantId();
    return mapper.toResponse(find(tenantId, id));
  }

  @Transactional
  public ServiceResponse create(ServiceRequest request, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    ServiceOffering service = new ServiceOffering();
    service.setTenantId(tenantId);
    apply(request, service);
    repository.save(service);
    auditService.record(tenantId, caller.id(), AuditAction.SERVICE_CREATED, ENTITY, service.getId(),
        Map.of("name", service.getName(), "priceCentavos", service.getPriceCentavos()));
    return mapper.toResponse(service);
  }

  @Transactional
  public ServiceResponse update(UUID id, ServiceRequest request, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    ServiceOffering service = find(tenantId, id);
    apply(request, service);
    auditService.record(tenantId, caller.id(), AuditAction.SERVICE_UPDATED, ENTITY, service.getId(),
        Map.of("name", service.getName(), "priceCentavos", service.getPriceCentavos(),
            "durationMinutes", service.getDurationMinutes(), "active", service.isActive()));
    return mapper.toResponse(service);
  }

  /** Services are soft-deleted (deactivated) because historical bookings reference them. */
  @Transactional
  public void deactivate(UUID id, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    ServiceOffering service = find(tenantId, id);
    service.setActive(false);
    auditService.record(tenantId, caller.id(), AuditAction.SERVICE_DEACTIVATED, ENTITY, service.getId(),
        Map.of("name", service.getName()));
  }

  private ServiceOffering find(UUID tenantId, UUID id) {
    return repository.findByIdAndTenantId(id, tenantId).orElseThrow(() -> NotFoundException.of("Service"));
  }

  private static void apply(ServiceRequest request, ServiceOffering service) {
    service.setName(request.name().trim());
    service.setDescription(request.description());
    service.setDurationMinutes(request.durationMinutes());
    service.setBufferMinutes(request.bufferMinutes() == null ? 0 : request.bufferMinutes());
    service.setPriceCentavos(request.priceCentavos());
    if (request.active() != null) {
      service.setActive(request.active());
    }
  }
}
