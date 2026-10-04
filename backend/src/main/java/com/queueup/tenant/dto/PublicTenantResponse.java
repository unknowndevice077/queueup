package com.queueup.tenant.dto;

import com.queueup.catalog.dto.ServiceResponse;
import java.util.List;
import java.util.UUID;

public record PublicTenantResponse(
    String name,
    String slug,
    String timezone,
    String currency,
    String contactEmail,
    String contactPhone,
    String address,
    int bookingLeadTimeMinutes,
    int cancellationWindowHours,
    boolean depositRequired,
    int depositPercent,
    List<ServiceResponse> services,
    List<StaffSummary> staff) {

  /** A bookable staff member as shown to customers, with the services they perform. */
  public record StaffSummary(UUID id, String name, List<UUID> serviceIds) {
  }
}
