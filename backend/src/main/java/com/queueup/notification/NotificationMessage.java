package com.queueup.notification;

/** A rendered notification ready for a channel to deliver. */
public record NotificationMessage(String recipient, String subject, String htmlBody, String textBody) {
}
