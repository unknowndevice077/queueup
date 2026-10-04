package com.queueup.booking.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Bookable start times for one staff member, in tenant-local time with offset. */
public record StaffAvailabilityResponse(UUID staffId, String staffName, List<OffsetDateTime> slots) {
}
