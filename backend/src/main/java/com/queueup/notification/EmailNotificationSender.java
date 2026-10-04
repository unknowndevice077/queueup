package com.queueup.notification;

import com.queueup.config.AppProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
public class EmailNotificationSender implements NotificationSender {

  private final JavaMailSender mailSender;
  private final String from;

  public EmailNotificationSender(JavaMailSender mailSender, AppProperties properties) {
    this.mailSender = mailSender;
    this.from = properties.mail().from();
  }

  @Override
  public NotificationChannel channel() {
    return NotificationChannel.EMAIL;
  }

  @Override
  public void send(NotificationMessage message) {
    try {
      MimeMessage mime = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
      helper.setFrom(from);
      helper.setTo(message.recipient());
      helper.setSubject(message.subject());
      helper.setText(message.textBody(), message.htmlBody());
      mailSender.send(mime);
    } catch (MessagingException ex) {
      throw new MailSendException("Could not build email", ex);
    }
  }
}
