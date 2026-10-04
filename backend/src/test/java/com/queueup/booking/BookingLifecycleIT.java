package com.queueup.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueup.config.AppProperties;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class BookingLifecycleIT extends IntegrationTest {

  @Autowired
  private PendingPaymentExpiryJob expiryJob;

  @Autowired
  private EntityManagerFactory entityManagerFactory;

  @Autowired
  private AppProperties properties;

  private Shop shop;
  private AppUser customer;
  private String customerToken;

  @BeforeEach
  void setUp() {
    shop = fixtures.shop("life");
    customer = fixtures.user("customer@life.test");
    customerToken = fixtures.token(customer);
  }

  @Test
  void availabilityListsOpenSlotsAndHidesBookedOnes() throws Exception {
    ZonedDateTime slot = TestFixtures.futureSlot(2, 10);
    String availability = "/api/public/tenants/life/availability?serviceId=" + shop.service().getId()
        + "&date=" + slot.toLocalDate();

    mockMvc.perform(get(availability))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].staffId").value(shop.ownerMembership().getId().toString()))
        .andExpect(jsonPath("$[0].slots[0]").value(TestFixtures.iso(slot.withHour(9))))
        .andExpect(jsonPath("$[0].slots.length()").value(31));

    book(slot, null).andExpect(status().isCreated());

    String body = mockMvc.perform(get(availability)).andReturn().getResponse().getContentAsString();
    assertThat(body).doesNotContain(TestFixtures.iso(slot))
        .doesNotContain(TestFixtures.iso(slot.minusMinutes(15)))
        .contains(TestFixtures.iso(slot.plusMinutes(30)));
  }

  @Test
  void createdBookingIsConfirmedWithPriceAndTenantLocalTimes() throws Exception {
    ZonedDateTime slot = TestFixtures.futureSlot(2, 14);

    book(slot, "Fade please")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CONFIRMED"))
        .andExpect(jsonPath("$.priceCentavos").value(25_000))
        .andExpect(jsonPath("$.depositCentavos").value(0))
        .andExpect(jsonPath("$.startsAt").value(TestFixtures.iso(slot)))
        .andExpect(jsonPath("$.endsAt").value(TestFixtures.iso(slot.plusMinutes(30))))
        .andExpect(jsonPath("$.staffName").value("owner"))
        .andExpect(jsonPath("$.notes").value("Fade please"));
    assertThat(jdbc.queryForObject("select count(*) from audit_log where action = 'BOOKING_CREATED'",
        Integer.class)).isEqualTo(1);
  }

  @Test
  void rejectsSlotsOutsideWorkingHoursOrInsideTheLeadTime() throws Exception {
    book(TestFixtures.futureSlot(2, 20), null).andExpect(status().isConflict())
        .andExpect(jsonPath("$.detail").value("Slot no longer available"));
    book(TestFixtures.futureSlot(2, 10).plusMinutes(7), null).andExpect(status().isConflict());
    book(ZonedDateTime.now(TestFixtures.MANILA).minusDays(1).withHour(10).withMinute(0).withSecond(0).withNano(0),
        null).andExpect(status().isConflict());
  }

  @Test
  void depositBusinessesHoldTheSlotAsPendingPayment() throws Exception {
    Shop clinic = fixtures.shop("clinic", true, 20);

    mockMvc.perform(post("/api/t/clinic/bookings").header("Authorization", bearer(customerToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceId", clinic.service().getId(),
                "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 10))))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("PENDING_PAYMENT"))
        .andExpect(jsonPath("$.depositCentavos").value(5_000));
  }

  @Test
  void customerCanCancelBeforeTheWindowButNotInsideIt() throws Exception {
    UUID early = bookingId(book(TestFixtures.futureSlot(3, 10), null));
    mockMvc.perform(post("/api/t/life/bookings/" + early + "/cancel").header("Authorization", bearer(customerToken))
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Change of plans\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"))
        .andExpect(jsonPath("$.cancelledReason").value("Change of plans"));

    Instant soon = Instant.now().plus(Duration.ofHours(3));
    Booking late = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        soon.minusSeconds(soon.getEpochSecond() % 900), BookingStatus.CONFIRMED);
    mockMvc.perform(post("/api/t/life/bookings/" + late.getId() + "/cancel")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/t/life/bookings/" + late.getId() + "/cancel")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk());
    mockMvc.perform(post("/api/t/life/bookings/" + late.getId() + "/cancel")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isConflict());
  }

  @Test
  void staffCompleteAndNoShowRules() throws Exception {
    Booking past = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        Instant.now().minus(Duration.ofHours(2)), BookingStatus.CONFIRMED);
    Booking future = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        TestFixtures.futureSlot(4, 10).toInstant(), BookingStatus.CONFIRMED);

    mockMvc.perform(post("/api/t/life/bookings/" + future.getId() + "/no-show")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/t/life/bookings/" + past.getId() + "/no-show")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("NO_SHOW"));
    mockMvc.perform(post("/api/t/life/bookings/" + past.getId() + "/complete")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/t/life/bookings/" + future.getId() + "/complete")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
  }

  @Test
  void rescheduleMovesTheBookingAndRevalidatesTheNewSlot() throws Exception {
    UUID id = bookingId(book(TestFixtures.futureSlot(3, 10), null));
    UUID blocker = bookingId(book(TestFixtures.futureSlot(3, 15), null));
    ZonedDateTime newSlot = TestFixtures.futureSlot(3, 11);

    mockMvc.perform(post("/api/t/life/bookings/" + id + "/reschedule").header("Authorization", bearer(customerToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(newSlot)))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.startsAt").value(TestFixtures.iso(newSlot)));
    mockMvc.perform(post("/api/t/life/bookings/" + id + "/reschedule").header("Authorization", bearer(customerToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(TestFixtures.futureSlot(3, 15))))))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/t/life/bookings/" + id + "/reschedule").header("Authorization", bearer(customerToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(newSlot.plusMinutes(15))))))
        .andExpect(status().isOk());
    assertThat(blocker).isNotNull();
  }

  @Test
  void expiryJobCancelsUnpaidBookingsOlderThanFifteenMinutes() throws Exception {
    fixtures.shop("unpaid", true, 50);
    UUID stale = UUID.fromString(json(mockMvc.perform(post("/api/t/unpaid/bookings")
            .header("Authorization", bearer(customerToken)).contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceId", serviceIdOf("unpaid"),
                "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 10))))))
        .andExpect(status().isCreated()).andReturn()).get("id").asText());
    UUID fresh = UUID.fromString(json(mockMvc.perform(post("/api/t/unpaid/bookings")
            .header("Authorization", bearer(customerToken)).contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceId", serviceIdOf("unpaid"),
                "startsAt", TestFixtures.iso(TestFixtures.futureSlot(2, 11))))))
        .andExpect(status().isCreated()).andReturn()).get("id").asText());
    jdbc.update("update booking set created_at = now() - interval '16 minutes' where id = ?", stale);

    expiryJob.run();

    assertThat(statusOf(stale)).isEqualTo("CANCELLED");
    assertThat(statusOf(fresh)).isEqualTo("PENDING_PAYMENT");
    assertThat(jdbc.queryForObject("select cancelled_reason from booking where id = ?", String.class, stale))
        .contains("not paid");
    assertThat(properties.booking().pendingPaymentTtl()).isEqualTo(Duration.ofMinutes(15));
  }

  @Test
  void bookingListUsesAConstantNumberOfQueries() throws Exception {
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    long fewBookings = statementsForListingAfterCreating(2, stats);
    long manyBookings = statementsForListingAfterCreating(10, stats);

    assertThat(manyBookings).as("no N+1 on the bookings list").isEqualTo(fewBookings);
    assertThat(manyBookings).isLessThanOrEqualTo(6);
  }

  private long statementsForListingAfterCreating(int extra, Statistics stats) throws Exception {
    int existing = jdbc.queryForObject("select count(*) from booking", Integer.class);
    for (int i = 0; i < extra; i++) {
      AppUser someone = fixtures.user("n" + (existing + i) + "@life.test");
      fixtures.booking(shop.tenant(), someone, shop.ownerMembership(), shop.service(),
          TestFixtures.futureSlot(1, 9).plusMinutes(30L * (existing + i)).toInstant(), BookingStatus.CONFIRMED);
    }
    LocalDate from = LocalDate.now(TestFixtures.MANILA);
    stats.clear();
    mockMvc.perform(get("/api/t/life/bookings?from=" + from + "&to=" + from.plusDays(3))
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(existing + extra));
    return stats.getPrepareStatementCount();
  }

  private ResultActions book(ZonedDateTime start, String notes) throws Exception {
    Map<String, Object> body = new HashMap<>();
    body.put("serviceId", shop.service().getId());
    body.put("startsAt", TestFixtures.iso(start));
    if (notes != null) {
      body.put("notes", notes);
    }
    return mockMvc.perform(post("/api/t/life/bookings").header("Authorization", bearer(customerToken))
        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
  }

  private UUID bookingId(ResultActions actions) throws Exception {
    JsonNode node = json(actions.andExpect(status().isCreated()).andReturn());
    return UUID.fromString(node.get("id").asText());
  }

  private String statusOf(UUID id) {
    return jdbc.queryForObject("select status from booking where id = ?", String.class, id);
  }

  private UUID serviceIdOf(String slug) {
    return jdbc.queryForObject("""
        select s.id from service_offering s join tenant t on t.id = s.tenant_id where t.slug = ?
        """, UUID.class, slug);
  }
}
