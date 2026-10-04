package com.queueup.payment;

import com.queueup.auth.AuthUser;
import com.queueup.payment.dto.PaymentIntentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Payments")
@RestController
public class PaymentController {

  private final PaymentService paymentService;
  private final PayMongoWebhookService webhookService;

  public PaymentController(PaymentService paymentService, PayMongoWebhookService webhookService) {
    this.paymentService = paymentService;
    this.webhookService = webhookService;
  }

  @Operation(summary = "Create a PayMongo checkout for the booking deposit and return its URL")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/bookings/{id}/payment-intent")
  public PaymentIntentResponse createIntent(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return paymentService.createIntent(id, user);
  }

  @Operation(summary = "PayMongo webhook receiver (signature verified, idempotent by event id)")
  @PostMapping(value = "/api/webhooks/paymongo", consumes = MediaType.ALL_VALUE)
  public Map<String, String> paymongoWebhook(@RequestBody String rawBody,
      @RequestHeader(value = "Paymongo-Signature", required = false) String signature) {
    return Map.of("result", webhookService.handle(rawBody, signature).name());
  }
}
