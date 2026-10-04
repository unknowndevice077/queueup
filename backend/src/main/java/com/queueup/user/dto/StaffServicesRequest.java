package com.queueup.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record StaffServicesRequest(@NotNull @Size(max = 200) List<@NotNull UUID> serviceIds) {
}
