package com.queueup.payment;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueup.booking.BookingService;
import com.queueup.common.exception.BadRequestException;
import com.queueup.common.exception.UnauthorizedException;
import java.time.Clock;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles PayMongo webhooks: verify signature, dedupe by event id, then apply the event. The dedupe insert and
 * the state change share one transaction, so a failed attempt leaves no trace and PayMongo's retry is processed.
 */
@Service
public class PayMongoWebhookService {

  static final String CHECKOUT_PAID = "checkout_session.payment.paid";

  private static final Logger log = LoggerFactory.getLogger(PayMongoWebhookService.class);
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
  };

  private final PayMongoSignatureVerifier signatureVerifier;
  private final WebhookEventRepository eventRepository;
  private final PaymentRepository paymentRepository;
  private final BookingService bookingService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public PayMongoWebhookService(PayMongoSignatureVerifier signatureVerifier, WebhookEventRepository eventRepository,
      PaymentRepository paymentRepository, BookingService bookingService, ObjectMapper objectMapper, Clock clock) {
    this.signatureVerifier = signatureVerifier;
    this.eventRepository = eventRepository;
    this.paymentRepository = paymentRepository;
    this.bookingService = bookingService;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  /** Outcome of a delivery, mostly useful for tests and logs. */
  public enum Outcome {
    PROCESSED,
    DUPLICATE,
    IGNORED
  }

  @Transactional
  public Outcome handle(String rawBody, String signatureHeader) {
    if (!signatureVerifier.isValid(signatureHeader, rawBody)) {
      log.warn("Rejected PayMongo webhook with an invalid or stale signature");
      throw new UnauthorizedException("Invalid webhook signature");
    }
    JsonNode event = parse(rawBody).path("data");
    String eventId = event.path("id").asText();
    String type = event.path("attributes").path("type").asText();
    if (eventId.isEmpty()) {
      throw new BadRequestException("Webhook event id is missing");
    }
    if (eventRepository.insertIfAbsent(PaymentProvider.PAYMONGO.name(), eventId, type) == 0) {
      log.info("Duplicate PayMongo event {} ({}) ignored", eventId, type);
      return Outcome.DUPLICATE;
    }
    Outcome outcome = CHECKOUT_PAID.equals(type)
        ? applyCheckoutPaid(event.path("attributes").path("data"))
        : Outcome.IGNORED;
    eventRepository.findByEventId(eventId).ifPresent(stored -> stored.setProcessedAt(clock.instant()));
    log.info("PayMongo event {} ({}) {}", eventId, type, outcome);
    return outcome;
  }

  private Outcome applyCheckoutPaid(JsonNode checkoutSession) {
    String sessionId = checkoutSession.path("id").asText();
    Payment payment = paymentRepository.findByProviderAndProviderReference(PaymentProvider.PAYMONGO, sessionId)
        .orElse(null);
    if (payment == null) {
      log.warn("No payment matches PayMongo checkout session {}", sessionId);
      return Outcome.IGNORED;
    }
    if (payment.getStatus() == PaymentStatus.PAID) {
      return Outcome.DUPLICATE;
    }
    payment.setStatus(PaymentStatus.PAID);
    payment.setRawPayload(objectMapper.convertValue(checkoutSession, MAP_TYPE));
    bookingService.confirmAfterPayment(payment.getBookingId());
    return Outcome.PROCESSED;
  }

  private JsonNode parse(String rawBody) {
    try {
      return objectMapper.readTree(rawBody);
    } catch (JsonProcessingException ex) {
      throw new BadRequestException("Webhook body is not valid JSON");
    }
  }
}
