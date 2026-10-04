package com.queueup.payment;

import java.util.UUID;

/** Hosted-checkout payment provider. PayMongo is the implementation; tests substitute a fake. */
public interface PaymentGateway {

  boolean isConfigured();

  CheckoutSession createCheckout(CheckoutRequest request);

  /** What we ask the provider to charge. */
  record CheckoutRequest(UUID bookingId, UUID paymentId, long amountCentavos, String description,
      String customerEmail, String customerName, String successUrl, String cancelUrl) {
  }

  /** The provider's checkout session: its id (stored as provider_reference) and the URL to redirect to. */
  record CheckoutSession(String id, String checkoutUrl) {
  }
}
