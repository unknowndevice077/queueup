package com.queueup.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueup.common.exception.ServiceUnavailableException;
import com.queueup.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Creates PayMongo Checkout Sessions (GCash, Maya and cards). Uses test keys in non-production setups. */
@Component
public class PayMongoGateway implements PaymentGateway {

  private static final Logger log = LoggerFactory.getLogger(PayMongoGateway.class);

  private final AppProperties.Payments.PayMongo config;
  private final RestClient restClient;

  public PayMongoGateway(AppProperties properties, RestClient.Builder restClientBuilder) {
    this.config = properties.payments().paymongo();
    String credentials = Base64.getEncoder()
        .encodeToString((nullToEmpty(config.secretKey()) + ":").getBytes(StandardCharsets.UTF_8));
    this.restClient = restClientBuilder
        .baseUrl(config.baseUrl())
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
        .build();
  }

  @Override
  public boolean isConfigured() {
    return config.configured();
  }

  @Override
  public CheckoutSession createCheckout(CheckoutRequest request) {
    if (!isConfigured()) {
      throw new ServiceUnavailableException("Online payments are not configured for this environment");
    }
    Map<String, Object> attributes = Map.of(
        "line_items", List.of(Map.of(
            "currency", "PHP",
            "amount", request.amountCentavos(),
            "name", request.description(),
            "quantity", 1)),
        "payment_method_types", List.of("gcash", "paymaya", "card"),
        "description", request.description(),
        "reference_number", request.paymentId().toString(),
        "success_url", request.successUrl(),
        "cancel_url", request.cancelUrl(),
        "send_email_receipt", false,
        "show_line_items", true,
        "billing", Map.of("email", request.customerEmail(), "name", request.customerName()),
        "metadata", Map.of(
            "booking_id", request.bookingId().toString(),
            "payment_id", request.paymentId().toString()));
    try {
      JsonNode response = restClient.post()
          .uri("/v1/checkout_sessions")
          .contentType(MediaType.APPLICATION_JSON)
          .body(Map.of("data", Map.of("attributes", attributes)))
          .retrieve()
          .body(JsonNode.class);
      JsonNode data = response == null ? null : response.path("data");
      if (data == null || data.path("id").asText().isEmpty()) {
        throw new ServiceUnavailableException("Payment provider returned an unexpected response");
      }
      return new CheckoutSession(data.path("id").asText(), data.path("attributes").path("checkout_url").asText());
    } catch (RestClientException ex) {
      log.warn("PayMongo checkout creation failed: {}", ex.getMessage());
      throw new ServiceUnavailableException("Payment provider is unavailable. Please try again.");
    }
  }

  private static String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
