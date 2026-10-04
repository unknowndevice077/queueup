package com.queueup.tenant;

import com.queueup.auth.AuthUser;
import com.queueup.common.tenant.TenantContext;
import com.queueup.common.web.ProblemResponseWriter;
import com.queueup.user.Membership;
import com.queueup.user.MembershipRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the tenant from {@code /api/t/{slug}/...} and {@code /api/public/tenants/{slug}/...}, then binds a
 * {@link TenantContext} (tenant plus the caller membership, if any) for the rest of the request.
 * Runs after authentication so the membership lookup can use the verified user id.
 */
public class TenantResolutionFilter extends OncePerRequestFilter {

  private static final Pattern TENANT_PATH = Pattern.compile("^/api/(?:t|public/tenants)/([^/]+)(?:/.*)?$");
  private static final String MDC_TENANT = "tenant";

  private final TenantRepository tenantRepository;
  private final MembershipRepository membershipRepository;
  private final ProblemResponseWriter problemWriter;

  public TenantResolutionFilter(TenantRepository tenantRepository, MembershipRepository membershipRepository,
      ProblemResponseWriter problemWriter) {
    this.tenantRepository = tenantRepository;
    this.membershipRepository = membershipRepository;
    this.problemWriter = problemWriter;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !TENANT_PATH.matcher(request.getRequestURI()).matches();
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Matcher matcher = TENANT_PATH.matcher(request.getRequestURI());
    if (!matcher.matches()) {
      chain.doFilter(request, response);
      return;
    }
    Optional<Tenant> tenant = tenantRepository.findBySlug(matcher.group(1)).filter(Tenant::isActive);
    if (tenant.isEmpty()) {
      problemWriter.write(request, response, HttpStatus.NOT_FOUND, "Not Found", "Business not found");
      return;
    }
    Optional<Membership> membership = currentUserId()
        .flatMap(userId -> membershipRepository.findByTenantIdAndUserId(tenant.get().getId(), userId))
        .filter(Membership::isActive);
    TenantContext.set(new TenantContext(
        tenant.get().getId(),
        tenant.get().getSlug(),
        tenant.get().zoneId(),
        membership.map(Membership::getId).orElse(null),
        membership.map(Membership::getRole).orElse(null)));
    MDC.put(MDC_TENANT, tenant.get().getSlug());
    try {
      chain.doFilter(request, response);
    } finally {
      TenantContext.clear();
      MDC.remove(MDC_TENANT);
    }
  }

  private static Optional<UUID> currentUserId() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null && authentication.getPrincipal() instanceof AuthUser user) {
      return Optional.of(user.id());
    }
    return Optional.empty();
  }
}
