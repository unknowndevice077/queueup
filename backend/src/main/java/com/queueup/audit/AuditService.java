package com.queueup.audit;

import com.queueup.audit.dto.AuditLogResponse;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.web.PageResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Append-only audit trail. Entries are written in the same transaction as the change they describe. */
@Service
public class AuditService {

  private final AuditLogRepository repository;
  private final TenantAccess tenantAccess;

  public AuditService(AuditLogRepository repository, TenantAccess tenantAccess) {
    this.repository = repository;
    this.tenantAccess = tenantAccess;
  }

  @Transactional
  public void record(UUID tenantId, UUID actorUserId, AuditAction action, String entityType, UUID entityId,
      Map<String, Object> details) {
    AuditLog entry = new AuditLog();
    entry.setTenantId(tenantId);
    entry.setActorUserId(actorUserId);
    entry.setAction(action.name());
    entry.setEntityType(entityType);
    entry.setEntityId(entityId);
    entry.setDetails(details == null || details.isEmpty() ? null : details);
    repository.save(entry);
  }

  @Transactional(readOnly = true)
  public PageResponse<AuditLogResponse> list(Pageable pageable) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    return PageResponse.from(repository.findAllByTenantId(tenantId, pageable), entry -> new AuditLogResponse(
        entry.getId(), entry.getActorUserId(), entry.getAction(), entry.getEntityType(), entry.getEntityId(),
        entry.getDetails(), entry.getCreatedAt()));
  }
}
