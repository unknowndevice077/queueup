package com.queueup.schedule;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.common.exception.BadRequestException;
import com.queueup.common.exception.ForbiddenException;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import com.queueup.common.tenant.TenantRole;
import com.queueup.common.web.PageResponse;
import com.queueup.schedule.dto.BlackoutRequest;
import com.queueup.schedule.dto.BlackoutResponse;
import com.queueup.user.MembershipRepository;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Blackouts: OWNER manages all of them; STAFF may only manage their own. */
@Service
public class BlackoutService {

  private static final String ENTITY = "BLACKOUT";

  private final BlackoutRepository repository;
  private final MembershipRepository membershipRepository;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;

  public BlackoutService(BlackoutRepository repository, MembershipRepository membershipRepository,
      TenantAccess tenantAccess, AuditService auditService) {
    this.repository = repository;
    this.membershipRepository = membershipRepository;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
  }

  @Transactional(readOnly = true)
  public PageResponse<BlackoutResponse> list(Pageable pageable) {
    TenantContext context = tenantAccess.requireMember();
    Page<Blackout> page = context.role() == TenantRole.OWNER
        ? repository.findAllByTenantId(context.tenantId(), pageable)
        : repository.findVisibleToStaff(context.tenantId(), context.membershipId(), pageable);
    return PageResponse.from(page, blackout -> toResponse(blackout, context.zone()));
  }

  @Transactional
  public BlackoutResponse create(BlackoutRequest request, AuthUser caller) {
    TenantContext context = tenantAccess.requireMember();
    authorizeTarget(context, request.membershipId());
    Blackout blackout = new Blackout();
    blackout.setTenantId(context.tenantId());
    apply(request, blackout);
    repository.save(blackout);
    auditService.record(context.tenantId(), caller.id(), AuditAction.BLACKOUT_CREATED, ENTITY, blackout.getId(),
        details(blackout));
    return toResponse(blackout, context.zone());
  }

  @Transactional
  public BlackoutResponse update(UUID id, BlackoutRequest request, AuthUser caller) {
    TenantContext context = tenantAccess.requireMember();
    Blackout blackout = find(context, id);
    authorizeTarget(context, blackout.getMembershipId());
    authorizeTarget(context, request.membershipId());
    apply(request, blackout);
    auditService.record(context.tenantId(), caller.id(), AuditAction.BLACKOUT_UPDATED, ENTITY, blackout.getId(),
        details(blackout));
    return toResponse(blackout, context.zone());
  }

  @Transactional
  public void delete(UUID id, AuthUser caller) {
    TenantContext context = tenantAccess.requireMember();
    Blackout blackout = find(context, id);
    authorizeTarget(context, blackout.getMembershipId());
    repository.delete(blackout);
    auditService.record(context.tenantId(), caller.id(), AuditAction.BLACKOUT_DELETED, ENTITY, id,
        details(blackout));
  }

  private Blackout find(TenantContext context, UUID id) {
    return repository.findByIdAndTenantId(id, context.tenantId()).orElseThrow(() -> NotFoundException.of("Blackout"));
  }

  private void authorizeTarget(TenantContext context, UUID targetMembershipId) {
    if (targetMembershipId != null) {
      membershipRepository.findById(targetMembershipId)
          .filter(m -> m.getTenantId().equals(context.tenantId()))
          .orElseThrow(() -> NotFoundException.of("Staff member"));
    }
    if (context.role() == TenantRole.OWNER) {
      return;
    }
    if (!Objects.equals(targetMembershipId, context.membershipId())) {
      throw new ForbiddenException("Staff can only manage their own blackouts");
    }
  }

  private static void apply(BlackoutRequest request, Blackout blackout) {
    if (!request.startsAt().isBefore(request.endsAt())) {
      throw new BadRequestException("endsAt", "must be after startsAt");
    }
    blackout.setMembershipId(request.membershipId());
    blackout.setStartsAt(request.startsAt().toInstant());
    blackout.setEndsAt(request.endsAt().toInstant());
    blackout.setReason(request.reason());
  }

  private static Map<String, Object> details(Blackout blackout) {
    Map<String, Object> details = new HashMap<>();
    details.put("startsAt", blackout.getStartsAt().toString());
    details.put("endsAt", blackout.getEndsAt().toString());
    details.put("membershipId", blackout.getMembershipId() == null ? "BUSINESS" : blackout.getMembershipId());
    return details;
  }

  private static BlackoutResponse toResponse(Blackout blackout, ZoneId zone) {
    return new BlackoutResponse(blackout.getId(), blackout.getMembershipId(),
        blackout.getStartsAt().atZone(zone).toOffsetDateTime(), blackout.getEndsAt().atZone(zone).toOffsetDateTime(),
        blackout.getReason());
  }
}
