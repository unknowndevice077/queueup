package com.queueup.user;

import com.queueup.common.exception.NotFoundException;
import com.queueup.tenant.Tenant;
import com.queueup.tenant.TenantRepository;
import com.queueup.user.dto.MeResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeService {

  private final AppUserRepository userRepository;
  private final MembershipRepository membershipRepository;
  private final TenantRepository tenantRepository;
  private final UserMapper userMapper;

  public MeService(AppUserRepository userRepository, MembershipRepository membershipRepository,
      TenantRepository tenantRepository, UserMapper userMapper) {
    this.userRepository = userRepository;
    this.membershipRepository = membershipRepository;
    this.tenantRepository = tenantRepository;
    this.userMapper = userMapper;
  }

  @Transactional(readOnly = true)
  public MeResponse me(UUID userId) {
    AppUser user = userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User"));
    List<Membership> memberships = membershipRepository.findActiveByUserId(userId);
    Map<UUID, Tenant> tenants = tenantRepository
        .findAllById(memberships.stream().map(Membership::getTenantId).toList())
        .stream()
        .collect(Collectors.toMap(Tenant::getId, Function.identity()));
    List<MeResponse.MembershipSummary> summaries = memberships.stream()
        .filter(m -> tenants.containsKey(m.getTenantId()))
        .map(m -> {
          Tenant tenant = tenants.get(m.getTenantId());
          return new MeResponse.MembershipSummary(m.getId(), tenant.getId(), tenant.getSlug(), tenant.getName(),
              tenant.getTimezone(), m.getRole());
        })
        .toList();
    return new MeResponse(userMapper.toResponse(user), summaries);
  }
}
