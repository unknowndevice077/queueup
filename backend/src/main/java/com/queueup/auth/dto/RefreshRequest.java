package com.queueup.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(@NotBlank String refreshToken) {

  @Override
  public String toString() {
    return "RefreshRequest[redacted]";
  }
}
