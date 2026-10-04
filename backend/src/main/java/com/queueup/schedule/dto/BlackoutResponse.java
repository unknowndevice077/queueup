package com.queueup.schedule.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BlackoutResponse(UUID id, UUID membershipId, OffsetDateTime startsAt, OffsetDateTime endsAt,
    String reason) {
}
