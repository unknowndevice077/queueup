package com.queueup.notification;

import com.queueup.config.AsyncConfig;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends notifications only after the booking transaction commits (no email for a rolled-back booking) and
 * off the request thread (a slow SMTP server never slows down the API).
 */
@Component
public class BookingNotificationListener {

  private final NotificationService notificationService;

  public BookingNotificationListener(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @Async(AsyncConfig.NOTIFICATION_EXECUTOR)
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onBookingEvent(BookingNotificationEvent event) {
    notificationService.sendBookingEmail(event.bookingId(), event.type());
  }
}
