package com.queueup.common.tenant;

import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

/**
 * The tenant resolved for the current request, plus the caller membership in it (if any).
 * Held in a thread-local that the resolution filter sets and always clears, so it lives
 * exactly as long as the request.
 */
public record TenantContext(UUID tenantId, String slug, ZoneId zone, UUID membershipId, TenantRole role) {

  private static final ThreadLocal<TenantContext> CURRENT = new ThreadLocal<>();

  public static void set(TenantContext context) {
    CURRENT.set(context);
  }

  public static Optional<TenantContext> current() {
    return Optional.ofNullable(CURRENT.get());
  }

  public static TenantContext require() {
    TenantContext context = CURRENT.get();
    if (context == null) {
      throw new IllegalStateException("No tenant context bound to this thread");
    }
    return context;
  }

  public static void clear() {
    CURRENT.remove();
  }

  public boolean isMember() {
    return membershipId != null;
  }
}
