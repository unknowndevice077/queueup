package com.queueup.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.booking.Booking;
import com.queueup.booking.BookingStatus;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import jakarta.mail.Message;
import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;

class NotificationIT extends IntegrationTest {

  @Autowired
  private ReminderJob reminderJob;

  private Shop shop;
  private AppUser customer;

  @BeforeEach
  void setUp() {
    shop = fixtures.shop("notify");
    customer = fixtures.user("customer@notify.test");
  }

  @Test
  void confirmationEmailIsSentAfterCommitAndLogged() throws Exception {
    mockMvc.perform(post("/api/t/notify/bookings").header("Authorization", bearer(fixtures.token(customer)))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceId", shop.service().getId(),
                "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 10))))))
        .andExpect(status().isCreated());

    await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(jdbc.queryForObject(
        "select count(*) from notification_log where type = 'CONFIRMATION' and status = 'SENT'", Integer.class))
        .isEqualTo(1));
    ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
    verify(mailSender).send(sent.capture());
    assertThat(sent.getValue().getRecipients(Message.RecipientType.TO)[0].toString())
        .isEqualTo("customer@notify.test");
    assertThat(sent.getValue().getSubject()).contains("Booking confirmed").contains("Haircut");
  }

  @Test
  void reminderJobSendsOncePerBookingNoMatterHowOftenItRuns() {
    Instant tomorrowish = Instant.now().plus(Duration.ofHours(20));
    Booking due = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        tomorrowish, BookingStatus.CONFIRMED);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        Instant.now().plus(Duration.ofDays(3)), BookingStatus.CONFIRMED);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        tomorrowish.plus(Duration.ofHours(1)), BookingStatus.CANCELLED);

    assertThat(reminderJob.sendDueReminders()).isEqualTo(1);
    assertThat(reminderJob.sendDueReminders()).isZero();
    reminderJob.run();

    verify(mailSender, times(1)).send(any(MimeMessage.class));
    assertThat(jdbc.queryForObject("select booking_id from notification_log where type = 'REMINDER_24H'",
        java.util.UUID.class)).isEqualTo(due.getId());
  }

  @Test
  void failedDeliveryIsLoggedAndRetriedOnTheNextRun() {
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        Instant.now().plus(Duration.ofHours(5)), BookingStatus.CONFIRMED);
    doThrow(new MailSendException("SMTP down")).when(mailSender).send(any(MimeMessage.class));

    assertThat(reminderJob.sendDueReminders()).isZero();
    assertThat(jdbc.queryForObject("select error from notification_log where status = 'FAILED'", String.class))
        .contains("SMTP down");

    org.mockito.Mockito.reset(mailSender);
    org.mockito.Mockito.when(mailSender.createMimeMessage())
        .thenAnswer(inv -> new MimeMessage(jakarta.mail.Session.getInstance(new java.util.Properties())));
    assertThat(reminderJob.sendDueReminders()).isEqualTo(1);
  }

  @Test
  void cancellationEmailIsSent() throws Exception {
    Booking booking = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        TestFixtures.futureSlot(3, 10).toInstant(), BookingStatus.CONFIRMED);

    mockMvc.perform(post("/api/t/notify/bookings/" + booking.getId() + "/cancel")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk());

    await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(jdbc.queryForObject(
        "select count(*) from notification_log where type = 'CANCELLATION' and status = 'SENT'", Integer.class))
        .isEqualTo(1));
  }
}
