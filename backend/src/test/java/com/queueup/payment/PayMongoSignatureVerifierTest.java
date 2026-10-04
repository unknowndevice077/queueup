package com.queueup.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.queueup.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PayMongoSignatureVerifierTest {

  private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");
  private static final String BODY = "{\"data\":{\"id\":\"evt_1\"}}";

  private final PayMongoSignatureVerifier verifier = new PayMongoSignatureVerifier(
      new AppProperties("http://localhost", false, null, null, null, new AppProperties.Payments(
          new AppProperties.Payments.PayMongo("sk", "whsk_secret", "https://api.paymongo.com", Duration.ofMinutes(5)))),
      Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void acceptsAValidTestModeSignature() {
    long t = NOW.getEpochSecond();
    String header = "t=" + t + ",te=" + verifier.sign(t + "." + BODY) + ",li=";

    assertThat(verifier.isValid(header, BODY)).isTrue();
  }

  @Test
  void acceptsAValidLiveModeSignature() {
    long t = NOW.getEpochSecond();
    String header = "t=" + t + ",te=,li=" + verifier.sign(t + "." + BODY);

    assertThat(verifier.isValid(header, BODY)).isTrue();
  }

  @Test
  void rejectsATamperedBody() {
    long t = NOW.getEpochSecond();
    String header = "t=" + t + ",te=" + verifier.sign(t + "." + BODY);

    assertThat(verifier.isValid(header, BODY.replace("evt_1", "evt_2"))).isFalse();
  }

  @Test
  void rejectsAStaleTimestamp() {
    long t = NOW.minus(Duration.ofMinutes(10)).getEpochSecond();
    String header = "t=" + t + ",te=" + verifier.sign(t + "." + BODY);

    assertThat(verifier.isValid(header, BODY)).isFalse();
  }

  @Test
  void rejectsMissingOrMalformedHeaders() {
    assertThat(verifier.isValid(null, BODY)).isFalse();
    assertThat(verifier.isValid("garbage", BODY)).isFalse();
    assertThat(verifier.isValid("t=abc,te=123", BODY)).isFalse();
  }
}
