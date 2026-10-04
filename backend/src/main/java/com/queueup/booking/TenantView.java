package com.queueup.booking;

import com.queueup.tenant.Tenant;
import java.time.ZoneId;

/** The tenant fields a booking response needs. Field names match {@code BookingResponse} for MapStruct. */
public record TenantView(String tenantSlug, String tenantName, String timezone, int cancellationWindowHours) {

  public static TenantView of(Tenant tenant) {
    return new TenantView(tenant.getSlug(), tenant.getName(), tenant.getTimezone(),
        tenant.getCancellationWindowHours());
  }

  public ZoneId zone() {
    return ZoneId.of(timezone);
  }
}
