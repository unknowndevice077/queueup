package com.queueup.config;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "queueup")
public record AppProperties(
    String frontendOrigin,
    boolean seedDemo,
    Security security,
    Booking booking,
    Mail mail,
    Payments payments) {

  public List<String> frontendOrigins() {
    return Arrays.stream(frontendOrigin.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
  }

  public String primaryFrontendOrigin() {
    return frontendOrigins().getFirst();
  }

  public record Security(
      String jwtSecret,
      Duration accessTokenTtl,
      Duration refreshTokenTtl,
      int bcryptStrength,
      int authRateLimitPerMinute) {
  }

  public record Booking(int slotStepMinutes, Duration pendingPaymentTtl) {
  }

  public record Mail(String from) {
  }

  public record Payments(PayMongo paymongo) {

    public record PayMongo(String secretKey, String webhookSecret, String baseUrl, Duration signatureTolerance) {

      public boolean configured() {
        return secretKey != null && !secretKey.isBlank();
      }
    }
  }
}
