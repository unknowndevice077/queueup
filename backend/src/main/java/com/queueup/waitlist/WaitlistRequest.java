package com.queueup.waitlist;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/** A waitlist signup from the public "families abroad" page. */
public record WaitlistRequest(
    @NotNull WaitlistKind kind,
    @NotBlank(message = "Enter your name") @Size(max = 120) String fullName,
    @NotBlank(message = "Enter your email") @Email(message = "Enter a valid email") @Size(max = 254) String email,
    @Size(max = 32) @Pattern(regexp = "^[0-9+()\\-\\s]*$", message = "Use digits, spaces, + or -") String phone,
    @Size(max = 80) String country,
    @Size(max = 160) String familyLocation,
    @Size(max = 40) String relation,
    @Size(max = 8) List<@Size(max = 40) String> services,
    @Size(max = 40) String frequency,
    @Size(max = 160) String clinicName,
    @Size(max = 120) String source,
    boolean consent) {

  @AssertTrue(message = "Please agree so we can contact you")
  public boolean isConsentGiven() {
    return consent;
  }

  @AssertTrue(message = "Enter the clinic name")
  public boolean isClinicNamePresent() {
    return kind != WaitlistKind.CLINIC || (clinicName != null && !clinicName.isBlank());
  }
}
