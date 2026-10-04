package com.queueup.booking;

import com.queueup.config.AppProperties;
import java.time.Duration;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Releases slots held by bookings whose deposit was not paid within the payment TTL (15 minutes). */
@Component
public class PendingPaymentExpiryJob {

  private final BookingService bookingService;
  private final Duration ttl;

  public PendingPaymentExpiryJob(BookingService bookingService, AppProperties properties) {
    this.bookingService = bookingService;
    this.ttl = properties.booking().pendingPaymentTtl();
  }

  @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT30S")
  public void run() {
    bookingService.expireStalePendingPayments(ttl);
  }
}
