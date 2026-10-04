package com.queueup.booking;

import com.queueup.booking.dto.BookingResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface BookingMapper {

  @Mapping(target = "id", source = "booking.id")
  @Mapping(target = "tenantId", source = "booking.tenantId")
  @Mapping(target = "createdAt", source = "booking.createdAt")
  @Mapping(target = "serviceId", source = "booking.service.id")
  @Mapping(target = "serviceName", source = "booking.service.name")
  @Mapping(target = "durationMinutes", source = "booking.service.durationMinutes")
  @Mapping(target = "staffId", source = "booking.staff.id")
  @Mapping(target = "staffName", source = "booking.staff.user.fullName")
  @Mapping(target = "customerId", source = "booking.customer.id")
  @Mapping(target = "customerName", source = "booking.customer.fullName")
  @Mapping(target = "customerEmail", source = "booking.customer.email")
  @Mapping(target = "customerPhone", source = "booking.customer.phone")
  @Mapping(target = "startsAt", expression = "java(local(booking.getStartsAt(), tenant))")
  @Mapping(target = "endsAt", expression = "java(serviceEnd(booking, tenant))")
  @Mapping(target = "customerChangeDeadline", expression = "java(changeDeadline(booking, tenant))")
  BookingResponse toResponse(Booking booking, TenantView tenant);

  default OffsetDateTime local(Instant instant, TenantView tenant) {
    return instant.atZone(tenant.zone()).toOffsetDateTime();
  }

  default OffsetDateTime serviceEnd(Booking booking, TenantView tenant) {
    return local(booking.getStartsAt().plus(Duration.ofMinutes(booking.getService().getDurationMinutes())), tenant);
  }

  default OffsetDateTime changeDeadline(Booking booking, TenantView tenant) {
    return local(CancellationPolicy.customerDeadline(booking.getStartsAt(), tenant.cancellationWindowHours()), tenant);
  }
}
