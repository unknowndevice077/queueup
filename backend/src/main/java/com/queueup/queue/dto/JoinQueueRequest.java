package com.queueup.queue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record JoinQueueRequest(
    @NotBlank @Size(max = 120) String customerName,
    @NotBlank
    @Size(min = 7, max = 32)
    @Pattern(regexp = "^[0-9+()\\-\\s]+$", message = "must be a valid phone number")
    String customerPhone,
    UUID serviceId) {
}
