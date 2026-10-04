package com.queueup.auth.dto;

import com.queueup.user.dto.UserResponse;

public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserResponse user) {

  @Override
  public String toString() {
    return "AuthResponse[user=" + user + "]";
  }
}
