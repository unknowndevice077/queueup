package com.queueup.catalog.dto;

import java.util.UUID;

public record ServiceResponse(
    UUID id,
    String name,
    String description,
    int durationMinutes,
    int bufferMinutes,
    long priceCentavos,
    boolean active) {
}
