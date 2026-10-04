package com.queueup.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Placeholder SMS channel that only logs. Swapping in a provider such as Semaphore or Twilio means
 * implementing {@link #send} here; nothing else changes.
 */
@Component
public class SmsNotificationSender implements NotificationSender {

  private static final Logger log = LoggerFactory.getLogger(SmsNotificationSender.class);

  @Override
  public NotificationChannel channel() {
    return NotificationChannel.SMS;
  }

  @Override
  public void send(NotificationMessage message) {
    log.info("SMS (stub) to {}: {}", mask(message.recipient()), message.subject());
  }

  private static String mask(String phone) {
    if (phone == null || phone.length() < 4) {
      return "****";
    }
    return "****" + phone.substring(phone.length() - 4);
  }
}
