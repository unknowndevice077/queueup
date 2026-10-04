package com.queueup.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank
    @Size(min = 10, max = 100, message = "must be at least 10 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "must contain at least one letter and one number")
    String password,
    @NotBlank @Size(max = 120) String fullName,
    @Size(max = 32) @Pattern(regexp = "^[0-9+()\\-\\s]*$", message = "must be a valid phone number") String phone) {

  @Override
  public String toString() {
    return "RegisterRequest[email=" + email + ", fullName=" + fullName + "]";
  }
}
