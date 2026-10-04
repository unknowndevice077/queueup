package com.queueup.notification;

/** A delivery channel. Add a new channel (SMS, push, Viber) by implementing this interface as a bean. */
public interface NotificationSender {

  NotificationChannel channel();

  /** Delivers the message or throws if delivery failed. */
  void send(NotificationMessage message);
}
