package com.queueup.payment.dto;

import com.queueup.payment.PaymentStatus;
import java.util.UUID;

public record PaymentIntentResponse(UUID paymentId, UUID bookingId, long amountCentavos, PaymentStatus status,
    String checkoutUrl) {
}
