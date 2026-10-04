package com.queueup.audit;

import com.queueup.audit.dto.AuditLogResponse;
import com.queueup.common.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Audit log")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/t/{slug}/audit-log")
public class AuditController {

  private final AuditService auditService;

  public AuditController(AuditService auditService) {
    this.auditService = auditService;
  }

  @Operation(summary = "Paginated audit trail for the business (OWNER)")
  @GetMapping
  public PageResponse<AuditLogResponse> list(@PathVariable String slug,
      @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
      Pageable pageable) {
    return auditService.list(pageable);
  }
}
