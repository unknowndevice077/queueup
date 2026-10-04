package com.queueup.notification;

import com.queueup.booking.Booking;
import com.queueup.booking.BookingRepository;
import com.queueup.booking.BookingStatus;
import com.queueup.common.MoneyFormat;
import com.queueup.config.AppProperties;
import com.queueup.tenant.Tenant;
import com.queueup.tenant.TenantRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Renders and delivers booking notifications. Idempotent: a notification already SENT for a booking, type and
 * channel is never sent again (checked here and enforced by a partial unique index).
 */
@Service
public class NotificationService {

  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
  private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("EEE, d MMM yyyy 'at' h:mm a",
      Locale.ENGLISH);
  private static final int MAX_ERROR_LENGTH = 500;

  private final BookingRepository bookingRepository;
  private final TenantRepository tenantRepository;
  private final NotificationLogRepository logRepository;
  private final Map<NotificationChannel, NotificationSender> senders;
  private final TemplateEngine templateEngine;
  private final Clock clock;
  private final String frontendOrigin;

  public NotificationService(BookingRepository bookingRepository, TenantRepository tenantRepository,
      NotificationLogRepository logRepository, List<NotificationSender> senders, TemplateEngine templateEngine,
      Clock clock, AppProperties properties) {
    this.bookingRepository = bookingRepository;
    this.tenantRepository = tenantRepository;
    this.logRepository = logRepository;
    this.senders = senders.stream().collect(Collectors.toMap(NotificationSender::channel, Function.identity()));
    this.templateEngine = templateEngine;
    this.clock = clock;
    this.frontendOrigin = properties.primaryFrontendOrigin();
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public NotificationStatus sendBookingEmail(UUID bookingId, NotificationType type) {
    NotificationChannel channel = NotificationChannel.EMAIL;
    if (logRepository.existsByBookingIdAndTypeAndChannelAndStatus(bookingId, type, channel,
        NotificationStatus.SENT)) {
      return NotificationStatus.SENT;
    }
    Booking booking = bookingRepository.findDetailedById(bookingId).orElse(null);
    if (booking == null || !stillRelevant(booking, type)) {
      return null;
    }
    Tenant tenant = tenantRepository.findById(booking.getTenantId()).orElseThrow();
    NotificationMessage message = render(booking, tenant, type);

    NotificationLog entry = new NotificationLog();
    entry.setTenantId(booking.getTenantId());
    entry.setBookingId(bookingId);
    entry.setType(type);
    entry.setChannel(channel);
    entry.setRecipient(message.recipient());
    try {
      senders.get(channel).send(message);
      entry.setStatus(NotificationStatus.SENT);
      entry.setSentAt(clock.instant());
    } catch (RuntimeException ex) {
      log.warn("Sending {} for booking {} failed: {}", type, bookingId, ex.getMessage());
      entry.setStatus(NotificationStatus.FAILED);
      entry.setError(truncate(ex.getMessage()));
    }
    try {
      logRepository.saveAndFlush(entry);
    } catch (DataIntegrityViolationException duplicate) {
      log.info("{} for booking {} was already sent concurrently", type, bookingId);
    }
    return entry.getStatus();
  }

  /** Confirmed bookings starting within the next 24 hours that have not had their reminder yet. */
  @Transactional(readOnly = true)
  public List<UUID> dueReminderBookingIds() {
    Instant now = clock.instant();
    return bookingRepository.findIdsNeedingReminder(now, now.plus(Duration.ofHours(24)));
  }

  private boolean stillRelevant(Booking booking, NotificationType type) {
    return switch (type) {
      case CONFIRMATION, REMINDER_24H -> booking.getStatus() == BookingStatus.CONFIRMED;
      case CANCELLATION -> booking.getStatus() == BookingStatus.CANCELLED;
    };
  }

  private NotificationMessage render(Booking booking, Tenant tenant, NotificationType type) {
    ZoneId zone = tenant.zoneId();
    Context context = new Context(Locale.ENGLISH);
    context.setVariable("customerName", booking.getCustomer().getFullName());
    context.setVariable("businessName", tenant.getName());
    context.setVariable("businessAddress", tenant.getAddress());
    context.setVariable("businessPhone", tenant.getContactPhone());
    context.setVariable("serviceName", booking.getService().getName());
    context.setVariable("staffName", booking.getStaff().getUser().getFullName());
    context.setVariable("when", WHEN.format(booking.getStartsAt().atZone(zone)));
    context.setVariable("price", MoneyFormat.peso(booking.getPriceCentavos()));
    context.setVariable("deposit", booking.getDepositCentavos() > 0
        ? MoneyFormat.peso(booking.getDepositCentavos()) : null);
    context.setVariable("cancelledReason", booking.getCancelledReason());
    context.setVariable("manageUrl", frontendOrigin + "/my/bookings");
    context.setVariable("bookAgainUrl", frontendOrigin + "/b/" + tenant.getSlug() + "/book");

    String template = switch (type) {
      case CONFIRMATION -> "email/booking-confirmation";
      case REMINDER_24H -> "email/booking-reminder";
      case CANCELLATION -> "email/booking-cancellation";
    };
    String subject = switch (type) {
      case CONFIRMATION -> "Booking confirmed: " + booking.getService().getName() + " at " + tenant.getName();
      case REMINDER_24H -> "Reminder: your appointment at " + tenant.getName() + " is coming up";
      case CANCELLATION -> "Booking cancelled: " + booking.getService().getName() + " at " + tenant.getName();
    };
    String text = subject + "\n\n" + booking.getService().getName() + " with "
        + booking.getStaff().getUser().getFullName() + "\n" + WHEN.format(booking.getStartsAt().atZone(zone))
        + "\n\nManage your bookings: " + frontendOrigin + "/my/bookings";
    return new NotificationMessage(booking.getCustomer().getEmail(), subject,
        templateEngine.process(template, context), text);
  }

  private static String truncate(String value) {
    if (value == null) {
      return "unknown error";
    }
    return value.length() <= MAX_ERROR_LENGTH ? value : value.substring(0, MAX_ERROR_LENGTH);
  }
}
