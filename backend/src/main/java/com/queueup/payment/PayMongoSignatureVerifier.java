package com.queueup.payment;

import com.queueup.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Verifies the {@code Paymongo-Signature} header: {@code t=<unix ts>,te=<test sig>,li=<live sig>} where each
 * signature is HMAC-SHA256(webhookSecret, t + "." + rawBody) in hex. Also rejects stale timestamps (replay).
 */
@Component
public class PayMongoSignatureVerifier {

  private static final String HMAC = "HmacSHA256";

  private final String webhookSecret;
  private final Duration tolerance;
  private final Clock clock;

  public PayMongoSignatureVerifier(AppProperties properties, Clock clock) {
    this.webhookSecret = properties.payments().paymongo().webhookSecret();
    this.tolerance = properties.payments().paymongo().signatureTolerance();
    this.clock = clock;
  }

  public boolean isValid(String header, String rawBody) {
    if (header == null || rawBody == null || webhookSecret == null || webhookSecret.isBlank()) {
      return false;
    }
    Map<String, String> parts = parse(header);
    String timestamp = parts.get("t");
    if (timestamp == null || !isFresh(timestamp)) {
      return false;
    }
    byte[] expected = sign(timestamp + "." + rawBody).getBytes(StandardCharsets.UTF_8);
    return matches(expected, parts.get("te")) || matches(expected, parts.get("li"));
  }

  public String sign(String payload) {
    try {
      Mac mac = Mac.getInstance(HMAC);
      mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), HMAC));
      return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
      throw new IllegalStateException("Cannot compute webhook signature", ex);
    }
  }

  private boolean isFresh(String timestamp) {
    try {
      Instant signedAt = Instant.ofEpochSecond(Long.parseLong(timestamp));
      return Duration.between(signedAt, clock.instant()).abs().compareTo(tolerance) <= 0;
    } catch (NumberFormatException ex) {
      return false;
    }
  }

  private static boolean matches(byte[] expected, String candidate) {
    return candidate != null && !candidate.isEmpty()
        && MessageDigest.isEqual(expected, candidate.getBytes(StandardCharsets.UTF_8));
  }

  private static Map<String, String> parse(String header) {
    Map<String, String> parts = new HashMap<>();
    for (String piece : header.split(",")) {
      int eq = piece.indexOf('=');
      if (eq > 0) {
        parts.put(piece.substring(0, eq).trim(), piece.substring(eq + 1).trim());
      }
    }
    return parts;
  }
}
