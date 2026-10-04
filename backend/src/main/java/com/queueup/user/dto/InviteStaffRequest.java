package com.queueup.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Adds an existing QueueUp account to the business as STAFF. */
public record InviteStaffRequest(@NotBlank @Email String email) {
}
