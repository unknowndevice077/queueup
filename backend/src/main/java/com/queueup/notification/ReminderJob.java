package com.queueup.notification;

import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Every 15 minutes, sends 24-hour reminders. Safe to run repeatedly thanks to the notification log. */
@Component
public class ReminderJob {

  private final NotificationService notificationService;

  public ReminderJob(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @Scheduled(cron = "0 */15 * * * *")
  public void run() {
    sendDueReminders();
  }

  /** Each reminder is sent in its own transaction, so one failure never blocks the others. */
  public int sendDueReminders() {
    int sent = 0;
    for (UUID bookingId : notificationService.dueReminderBookingIds()) {
      if (notificationService.sendBookingEmail(bookingId, NotificationType.REMINDER_24H) == NotificationStatus.SENT) {
        sent++;
      }
    }
    return sent;
  }
}
