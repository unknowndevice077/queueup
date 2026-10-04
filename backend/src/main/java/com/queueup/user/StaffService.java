package com.queueup.user;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.catalog.ServiceOffering;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.catalog.StaffServiceLink;
import com.queueup.catalog.StaffServiceLinkRepository;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantRole;
import com.queueup.schedule.WorkingHoursService;
import com.queueup.schedule.dto.WorkingHoursRange;
import com.queueup.user.dto.StaffResponse;
import com.queueup.user.dto.UpdateStaffRequest;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Staff membership management. Loads lists in a fixed number of queries (no N+1). */
@Service
public class StaffService {

  private static final String ENTITY = "MEMBERSHIP";

  private final MembershipRepository membershipRepository;
  private final AppUserRepository userRepository;
  private final ServiceOfferingRepository serviceRepository;
  private final StaffServiceLinkRepository linkRepository;
  private final WorkingHoursService workingHoursService;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;

  public StaffService(MembershipRepository membershipRepository, AppUserRepository userRepository,
      ServiceOfferingRepository serviceRepository, StaffServiceLinkRepository linkRepository,
      WorkingHoursService workingHoursService, TenantAccess tenantAccess, AuditService auditService) {
    this.membershipRepository = membershipRepository;
    this.userRepository = userRepository;
    this.serviceRepository = serviceRepository;
    this.linkRepository = linkRepository;
    this.workingHoursService = workingHoursService;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
  }

  @Transactional(readOnly = true)
  public List<StaffResponse> list() {
    UUID tenantId = tenantAccess.requireMember().tenantId();
    List<Membership> members = membershipRepository.findAllWithUserByTenantId(tenantId);
    Map<UUID, List<UUID>> servicesByMember = servicesByMember(tenantId);
    Map<UUID, List<WorkingHoursRange>> hoursByMember = workingHoursService.scheduleByMembership(tenantId);
    return members.stream()
        .map(m -> toResponse(m, servicesByMember.getOrDefault(m.getId(), List.of()),
            hoursByMember.getOrDefault(m.getId(), List.of())))
        .toList();
  }

  @Transactional(readOnly = true)
  public StaffResponse get(UUID membershipId) {
    UUID tenantId = tenantAccess.requireMember().tenantId();
    return detailed(tenantId, find(tenantId, membershipId));
  }

  @Transactional
  public StaffResponse invite(String email, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    AppUser user = userRepository.findByEmail(email.trim().toLowerCase(Locale.ROOT))
        .orElseThrow(() -> new NotFoundException("No QueueUp account uses that email. Ask them to sign up first."));
    Membership membership = membershipRepository.findByTenantIdAndUserId(tenantId, user.getId()).orElse(null);
    if (membership != null && membership.isActive()) {
      throw new ConflictException("This person is already a member of the business");
    }
    if (membership == null) {
      membership = new Membership();
      membership.setTenantId(tenantId);
      membership.setUser(user);
    }
    membership.setRole(TenantRole.STAFF);
    membership.setActive(true);
    membershipRepository.save(membership);
    auditService.record(tenantId, caller.id(), AuditAction.STAFF_ADDED, ENTITY, membership.getId(),
        Map.of("email", user.getEmail()));
    return detailed(tenantId, membership);
  }

  @Transactional
  public StaffResponse update(UUID membershipId, UpdateStaffRequest request, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    Membership membership = find(tenantId, membershipId);
    boolean losesOwnership = membership.getRole() == TenantRole.OWNER
        && (request.role() == TenantRole.STAFF || Boolean.FALSE.equals(request.active()));
    if (losesOwnership) {
      ensureAnotherOwnerRemains(tenantId);
    }
    if (request.role() != null) {
      membership.setRole(request.role());
    }
    if (request.active() != null) {
      membership.setActive(request.active());
    }
    Map<String, Object> details = new HashMap<>();
    details.put("role", membership.getRole().name());
    details.put("active", membership.isActive());
    auditService.record(tenantId, caller.id(), AuditAction.STAFF_UPDATED, ENTITY, membership.getId(), details);
    return detailed(tenantId, membership);
  }

  /** Deactivates the membership; history (bookings, audit) keeps pointing at it. */
  @Transactional
  public void remove(UUID membershipId, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    Membership membership = find(tenantId, membershipId);
    if (membership.getRole() == TenantRole.OWNER) {
      ensureAnotherOwnerRemains(tenantId);
    }
    membership.setActive(false);
    auditService.record(tenantId, caller.id(), AuditAction.STAFF_REMOVED, ENTITY, membership.getId(),
        Map.of("email", membership.getUser().getEmail()));
  }

  @Transactional
  public StaffResponse assignServices(UUID membershipId, List<UUID> serviceIds, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    Membership membership = find(tenantId, membershipId);
    Set<UUID> requested = new LinkedHashSet<>(serviceIds);
    List<ServiceOffering> services = serviceRepository.findAllByTenantIdAndIdIn(tenantId, requested);
    if (services.size() != requested.size()) {
      throw NotFoundException.of("Service");
    }
    linkRepository.deleteAllForMembership(tenantId, membershipId);
    linkRepository.saveAll(requested.stream().map(serviceId -> {
      StaffServiceLink link = new StaffServiceLink();
      link.setTenantId(tenantId);
      link.setMembershipId(membershipId);
      link.setServiceId(serviceId);
      return link;
    }).toList());
    auditService.record(tenantId, caller.id(), AuditAction.STAFF_SERVICES_UPDATED, ENTITY, membershipId,
        Map.of("serviceIds", requested.stream().map(UUID::toString).toList()));
    return detailed(tenantId, membership);
  }

  @Transactional
  public StaffResponse replaceWorkingHours(UUID membershipId, List<WorkingHoursRange> ranges, AuthUser caller) {
    UUID tenantId = tenantAccess.requireOwner().tenantId();
    Membership membership = find(tenantId, membershipId);
    workingHoursService.replaceWeeklySchedule(tenantId, membershipId, ranges);
    auditService.record(tenantId, caller.id(), AuditAction.STAFF_SCHEDULE_UPDATED, ENTITY, membershipId,
        Map.of("ranges", ranges.size()));
    return detailed(tenantId, membership);
  }

  private Membership find(UUID tenantId, UUID membershipId) {
    return membershipRepository.findWithUserByIdAndTenantId(membershipId, tenantId)
        .orElseThrow(() -> NotFoundException.of("Staff member"));
  }

  private void ensureAnotherOwnerRemains(UUID tenantId) {
    if (membershipRepository.countByTenantIdAndRoleAndActiveTrue(tenantId, TenantRole.OWNER) <= 1) {
      throw new ConflictException("A business must keep at least one active owner");
    }
  }

  private StaffResponse detailed(UUID tenantId, Membership membership) {
    List<UUID> serviceIds = linkRepository.findAllByTenantIdAndMembershipId(tenantId, membership.getId()).stream()
        .map(StaffServiceLink::getServiceId)
        .toList();
    List<WorkingHoursRange> hours = workingHoursService.scheduleByMembership(tenantId)
        .getOrDefault(membership.getId(), List.of());
    return toResponse(membership, serviceIds, hours);
  }

  private Map<UUID, List<UUID>> servicesByMember(UUID tenantId) {
    return linkRepository.findAllByTenantId(tenantId).stream()
        .collect(Collectors.groupingBy(StaffServiceLink::getMembershipId,
            Collectors.mapping(StaffServiceLink::getServiceId, Collectors.toList())));
  }

  private static StaffResponse toResponse(Membership membership, List<UUID> serviceIds,
      List<WorkingHoursRange> hours) {
    AppUser user = membership.getUser();
    return new StaffResponse(membership.getId(), user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
        membership.getRole(), membership.isActive(), serviceIds, hours);
  }
}
