package com.queueup.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class PaymentWebhookIT extends IntegrationTest {

  @Autowired
  private PayMongoSignatureVerifier verifier;

  private String customerToken;
  private UUID bookingId;
  private String checkoutSessionId;

  @BeforeEach
  void createPendingBookingWithCheckout() throws Exception {
    Shop clinic = fixtures.shop("clinic", true, 20);
    customerToken = fixtures.token(fixtures.user("patient@clinic.test"));
    bookingId = UUID.fromString(json(mockMvc.perform(post("/api/t/clinic/bookings")
            .header("Authorization", bearer(customerToken)).contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceId", clinic.service().getId(),
                "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 10))))))
        .andExpect(status().isCreated()).andReturn()).get("id").asText());

    var intent = json(mockMvc.perform(post("/api/t/clinic/bookings/" + bookingId + "/payment-intent")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amountCentavos").value(5_000))
        .andExpect(jsonPath("$.status").value("PENDING"))
        .andReturn());
    checkoutSessionId = "cs_test_" + intent.get("paymentId").asText();
    assertThat(intent.get("checkoutUrl").asText()).endsWith(checkoutSessionId);
  }

  @Test
  void paidEventConfirmsTheBookingExactlyOnceEvenWhenDeliveredTwice() throws Exception {
    String body = paidEvent("evt_paid_1", checkoutSessionId);

    deliver(body, signatureFor(body)).andExpect(status().isOk()).andExpect(jsonPath("$.result").value("PROCESSED"));
    deliver(body, signatureFor(body)).andExpect(status().isOk()).andExpect(jsonPath("$.result").value("DUPLICATE"));

    assertThat(jdbc.queryForObject("select status from booking where id = ?", String.class, bookingId))
        .isEqualTo("CONFIRMED");
    assertThat(jdbc.queryForObject("select status from payment where booking_id = ?", String.class, bookingId))
        .isEqualTo("PAID");
    assertThat(jdbc.queryForObject("select count(*) from webhook_event", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select processed_at is not null from webhook_event", Boolean.class)).isTrue();
    assertThat(jdbc.queryForObject("select count(*) from audit_log where action = 'BOOKING_CONFIRMED'",
        Integer.class)).isEqualTo(1);
  }

  @Test
  void invalidSignatureIsRejectedAndNothingChanges() throws Exception {
    String body = paidEvent("evt_forged", checkoutSessionId);

    deliver(body, "t=" + Instant.now().getEpochSecond() + ",te=deadbeef,li=")
        .andExpect(status().isUnauthorized());
    deliver(body, null).andExpect(status().isUnauthorized());

    assertThat(jdbc.queryForObject("select status from booking where id = ?", String.class, bookingId))
        .isEqualTo("PENDING_PAYMENT");
    assertThat(jdbc.queryForObject("select count(*) from webhook_event", Integer.class)).isZero();
  }

  @Test
  void unrelatedEventTypesAreAcknowledgedButIgnored() throws Exception {
    String body = "{\"data\":{\"id\":\"evt_other\",\"attributes\":{\"type\":\"source.chargeable\",\"data\":{}}}}";

    deliver(body, signatureFor(body)).andExpect(status().isOk()).andExpect(jsonPath("$.result").value("IGNORED"));
    assertThat(jdbc.queryForObject("select status from booking where id = ?", String.class, bookingId))
        .isEqualTo("PENDING_PAYMENT");
  }

  @Test
  void paymentIntentIsReusedAndRefusedForConfirmedBookings() throws Exception {
    mockMvc.perform(post("/api/t/clinic/bookings/" + bookingId + "/payment-intent")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.checkoutUrl").value(org.hamcrest.Matchers.endsWith(checkoutSessionId)));
    String body = paidEvent("evt_paid_2", checkoutSessionId);
    deliver(body, signatureFor(body)).andExpect(status().isOk());

    mockMvc.perform(post("/api/t/clinic/bookings/" + bookingId + "/payment-intent")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isConflict());
  }

  private org.springframework.test.web.servlet.ResultActions deliver(String body, String signature)
      throws Exception {
    var request = post("/api/webhooks/paymongo").contentType(MediaType.APPLICATION_JSON).content(body);
    if (signature != null) {
      request.header("Paymongo-Signature", signature);
    }
    return mockMvc.perform(request);
  }

  private String signatureFor(String body) {
    long timestamp = Instant.now().getEpochSecond();
    return "t=" + timestamp + ",te=" + verifier.sign(timestamp + "." + body) + ",li=";
  }

  private static String paidEvent(String eventId, String sessionId) {
    return """
        {"data":{"id":"%s","type":"event","attributes":{"type":"checkout_session.payment.paid","livemode":false,
        "data":{"id":"%s","type":"checkout_session","attributes":{"status":"paid"}}}}}
        """.formatted(eventId, sessionId);
  }
}
