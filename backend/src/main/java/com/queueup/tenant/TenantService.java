package com.queueup.tenant;

import com.queueup.audit.AuditAction;
import com.queueup.audit.AuditService;
import com.queueup.auth.AuthUser;
import com.queueup.catalog.ServiceMapper;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.catalog.StaffServiceLink;
import com.queueup.catalog.StaffServiceLinkRepository;
import com.queueup.common.exception.BadRequestException;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.exception.NotFoundException;
import com.queueup.common.tenant.TenantAccess;
import com.queueup.common.tenant.TenantContext;
import com.queueup.common.tenant.TenantRole;
import com.queueup.tenant.dto.CreateTenantRequest;
import com.queueup.tenant.dto.PublicTenantResponse;
import com.queueup.tenant.dto.TenantSettingsResponse;
import com.queueup.tenant.dto.UpdateSettingsRequest;
import com.queueup.user.AppUserRepository;
import com.queueup.user.Membership;
import com.queueup.user.MembershipRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantService {

  private final TenantRepository tenantRepository;
  private final MembershipRepository membershipRepository;
  private final AppUserRepository userRepository;
  private final ServiceOfferingRepository serviceRepository;
  private final StaffServiceLinkRepository staffServiceRepository;
  private final TenantMapper tenantMapper;
  private final ServiceMapper serviceMapper;
  private final TenantAccess tenantAccess;
  private final AuditService auditService;

  public TenantService(TenantRepository tenantRepository, MembershipRepository membershipRepository,
      AppUserRepository userRepository, ServiceOfferingRepository serviceRepository,
      StaffServiceLinkRepository staffServiceRepository, TenantMapper tenantMapper, ServiceMapper serviceMapper,
      TenantAccess tenantAccess, AuditService auditService) {
    this.tenantRepository = tenantRepository;
    this.membershipRepository = membershipRepository;
    this.userRepository = userRepository;
    this.serviceRepository = serviceRepository;
    this.staffServiceRepository = staffServiceRepository;
    this.tenantMapper = tenantMapper;
    this.serviceMapper = serviceMapper;
    this.tenantAccess = tenantAccess;
    this.auditService = auditService;
  }

  @Transactional
  public TenantSettingsResponse create(CreateTenantRequest request, AuthUser caller) {
    if (tenantRepository.existsBySlug(request.slug())) {
      throw new ConflictException("The address '" + request.slug() + "' is already taken");
    }
    Tenant tenant = new Tenant();
    tenant.setName(request.name().trim());
    tenant.setSlug(request.slug());
    if (request.timezone() != null) {
      tenant.setTimezone(request.timezone());
    }
    tenant.setContactEmail(request.contactEmail());
    tenant.setContactPhone(request.contactPhone());
    tenant.setAddress(request.address());
    tenantRepository.save(tenant);

    Membership owner = new Membership();
    owner.setTenantId(tenant.getId());
    owner.setUser(userRepository.getReferenceById(caller.id()));
    owner.setRole(TenantRole.OWNER);
    membershipRepository.save(owner);

    auditService.record(tenant.getId(), caller.id(), AuditAction.TENANT_CREATED, "TENANT", tenant.getId(),
        Map.of("slug", tenant.getSlug()));
    return tenantMapper.toSettings(tenant);
  }

  @Transactional(readOnly = true)
  public PublicTenantResponse getPublic() {
    Tenant tenant = currentTenant();
    var services = serviceRepository.findAllByTenantIdAndActiveTrueOrderByNameAsc(tenant.getId()).stream()
        .map(serviceMapper::toResponse)
        .toList();
    return new PublicTenantResponse(tenant.getName(), tenant.getSlug(), tenant.getTimezone(), tenant.getCurrency(),
        tenant.getContactEmail(), tenant.getContactPhone(), tenant.getAddress(), tenant.getBookingLeadTimeMinutes(),
        tenant.getCancellationWindowHours(), tenant.isDepositRequired(), tenant.getDepositPercent(), services,
        bookableStaff(tenant.getId()));
  }

  @Transactional(readOnly = true)
  public TenantSettingsResponse getSettings() {
    tenantAccess.requireMember();
    return tenantMapper.toSettings(currentTenant());
  }

  @Transactional
  public TenantSettingsResponse updateSettings(UpdateSettingsRequest request, AuthUser caller) {
    tenantAccess.requireOwner();
    Tenant tenant = currentTenant();
    tenantMapper.applySettings(request, tenant);
    if (tenant.isDepositRequired() && tenant.getDepositPercent() < 1) {
      throw new BadRequestException("depositPercent", "must be between 1 and 100 when a deposit is required");
    }
    auditService.record(tenant.getId(), caller.id(), AuditAction.SETTINGS_UPDATED, "TENANT", tenant.getId(),
        changedFields(request));
    return tenantMapper.toSettings(tenant);
  }

  private Tenant currentTenant() {
    return tenantRepository.findById(TenantContext.require().tenantId())
        .orElseThrow(() -> new NotFoundException("Business not found"));
  }

  private List<PublicTenantResponse.StaffSummary> bookableStaff(UUID tenantId) {
    Map<UUID, List<UUID>> servicesByStaff = staffServiceRepository.findAllByTenantId(tenantId).stream()
        .collect(Collectors.groupingBy(StaffServiceLink::getMembershipId,
            Collectors.mapping(StaffServiceLink::getServiceId, Collectors.toList())));
    return membershipRepository.findAllWithUserByTenantId(tenantId).stream()
        .filter(Membership::isActive)
        .filter(m -> servicesByStaff.containsKey(m.getId()))
        .map(m -> new PublicTenantResponse.StaffSummary(m.getId(), m.getUser().getFullName(),
            servicesByStaff.get(m.getId())))
        .toList();
  }

  private static Map<String, Object> changedFields(UpdateSettingsRequest request) {
    Map<String, Object> changes = new LinkedHashMap<>();
    putIfPresent(changes, "name", request.name());
    putIfPresent(changes, "timezone", request.timezone());
    putIfPresent(changes, "contactEmail", request.contactEmail());
    putIfPresent(changes, "contactPhone", request.contactPhone());
    putIfPresent(changes, "address", request.address());
    putIfPresent(changes, "bookingLeadTimeMinutes", request.bookingLeadTimeMinutes());
    putIfPresent(changes, "cancellationWindowHours", request.cancellationWindowHours());
    putIfPresent(changes, "depositRequired", request.depositRequired());
    putIfPresent(changes, "depositPercent", request.depositPercent());
    return changes;
  }

  private static void putIfPresent(Map<String, Object> map, String key, Object value) {
    if (value != null) {
      map.put(key, value);
    }
  }
}
