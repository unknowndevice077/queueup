package com.queueup.payment;

import com.queueup.auth.AuthUser;
import com.queueup.booking.Booking;
import com.queueup.booking.BookingService;
import com.queueup.booking.BookingStatus;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.tenant.TenantContext;
import com.queueup.config.AppProperties;
import com.queueup.payment.dto.PaymentIntentResponse;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {

  private final PaymentRepository paymentRepository;
  private final BookingService bookingService;
  private final PaymentGateway gateway;
  private final String frontendOrigin;

  public PaymentService(PaymentRepository paymentRepository, BookingService bookingService, PaymentGateway gateway,
      AppProperties properties) {
    this.paymentRepository = paymentRepository;
    this.bookingService = bookingService;
    this.gateway = gateway;
    this.frontendOrigin = properties.primaryFrontendOrigin();
  }

  /** Starts (or resumes) a hosted checkout for a booking's deposit. */
  @Transactional
  public PaymentIntentResponse createIntent(UUID bookingId, AuthUser caller) {
    TenantContext context = TenantContext.require();
    Booking booking = bookingService.findVisibleBooking(bookingId, caller);
    if (booking.getStatus() != BookingStatus.PENDING_PAYMENT || booking.getDepositCentavos() <= 0) {
      throw new ConflictException("This booking does not need a deposit payment");
    }
    var existing = paymentRepository.findFirstByTenantIdAndBookingIdAndStatusOrderByCreatedAtDesc(
        context.tenantId(), bookingId, PaymentStatus.PENDING);
    if (existing.isPresent() && existing.get().getCheckoutUrl() != null) {
      return toResponse(existing.get());
    }
    Payment payment = existing.orElseGet(Payment::new);
    payment.setTenantId(context.tenantId());
    payment.setBookingId(bookingId);
    payment.setProvider(PaymentProvider.PAYMONGO);
    payment.setAmountCentavos(booking.getDepositCentavos());
    payment.setStatus(PaymentStatus.PENDING);
    paymentRepository.save(payment);

    String bookingPage = frontendOrigin + "/b/" + context.slug() + "/book/success?bookingId=" + bookingId;
    PaymentGateway.CheckoutSession session = gateway.createCheckout(new PaymentGateway.CheckoutRequest(
        bookingId, payment.getId(), booking.getDepositCentavos(),
        "Deposit: " + booking.getService().getName(), booking.getCustomer().getEmail(),
        booking.getCustomer().getFullName(), bookingPage + "&paid=1", bookingPage + "&cancelled=1"));
    payment.setProviderReference(session.id());
    payment.setCheckoutUrl(session.checkoutUrl());
    return toResponse(payment);
  }

  private static PaymentIntentResponse toResponse(Payment payment) {
    return new PaymentIntentResponse(payment.getId(), payment.getBookingId(), payment.getAmountCentavos(),
        payment.getStatus(), payment.getCheckoutUrl());
  }
}
