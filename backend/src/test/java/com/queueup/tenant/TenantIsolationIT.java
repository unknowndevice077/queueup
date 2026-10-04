package com.queueup.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.booking.Booking;
import com.queueup.booking.BookingStatus;
import com.queueup.queue.QueueStatus;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

/**
 * Tenant A's owner must not be able to read or modify anything of tenant B, whether they address tenant B's slug
 * directly or smuggle tenant B's ids through their own slug. Every case answers 404 so existence is not leaked.
 */
class TenantIsolationIT extends IntegrationTest {

  private Shop shopA;
  private Shop shopB;
  private Booking bookingB;
  private UUID queueEntryB;
  private UUID blackoutB;

  @BeforeEach
  void setUpTwoTenants() {
    shopA = fixtures.shop("tenant-a");
    shopB = fixtures.shop("tenant-b");
    AppUser customerB = fixtures.user("customer@b.test");
    bookingB = fixtures.booking(shopB.tenant(), customerB, shopB.ownerMembership(), shopB.service(),
        TestFixtures.futureSlot(3, 10).toInstant(), BookingStatus.CONFIRMED);
    queueEntryB = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO queue_entry (id, tenant_id, queue_date, ticket_number, customer_name, customer_phone, status,
                                 joined_at)
        VALUES (?, ?, ?, 1, 'Walk In', '09170000000', 'WAITING', now())
        """, queueEntryB, shopB.tenant().getId(), LocalDate.now(TestFixtures.MANILA));
    blackoutB = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO blackout (id, tenant_id, starts_at, ends_at, reason)
        VALUES (?, ?, now() + interval '1 day', now() + interval '2 days', 'B only')
        """, blackoutB, shopB.tenant().getId());
  }

  @Test
  void ownerOfAGets404OnEveryEndpointOfB() throws Exception {
    String b = "/api/t/" + shopB.slug();
    List<Call> calls = List.of(
        new Call(HttpMethod.GET, b + "/settings", null),
        new Call(HttpMethod.PATCH, b + "/settings", "{\"name\":\"Hijacked\"}"),
        new Call(HttpMethod.GET, b + "/services", null),
        new Call(HttpMethod.GET, b + "/services/" + shopB.service().getId(), null),
        new Call(HttpMethod.POST, b + "/services", serviceJson()),
        new Call(HttpMethod.PUT, b + "/services/" + shopB.service().getId(), serviceJson()),
        new Call(HttpMethod.DELETE, b + "/services/" + shopB.service().getId(), null),
        new Call(HttpMethod.GET, b + "/staff", null),
        new Call(HttpMethod.POST, b + "/staff", "{\"email\":\"owner@tenant-a.test\"}"),
        new Call(HttpMethod.PATCH, b + "/staff/" + shopB.ownerMembership().getId(), "{\"active\":false}"),
        new Call(HttpMethod.DELETE, b + "/staff/" + shopB.ownerMembership().getId(), null),
        new Call(HttpMethod.PUT, b + "/staff/" + shopB.ownerMembership().getId() + "/working-hours",
            "{\"ranges\":[]}"),
        new Call(HttpMethod.GET, b + "/bookings", null),
        new Call(HttpMethod.GET, b + "/bookings/" + bookingB.getId(), null),
        new Call(HttpMethod.POST, b + "/bookings/" + bookingB.getId() + "/cancel", "{}"),
        new Call(HttpMethod.POST, b + "/bookings/" + bookingB.getId() + "/complete", null),
        new Call(HttpMethod.GET, b + "/queue", null),
        new Call(HttpMethod.POST, b + "/queue/call-next", null),
        new Call(HttpMethod.POST, b + "/queue/" + queueEntryB + "/serve", null),
        new Call(HttpMethod.GET, b + "/blackouts", null),
        new Call(HttpMethod.DELETE, b + "/blackouts/" + blackoutB, null),
        new Call(HttpMethod.GET, b + "/analytics/summary", null),
        new Call(HttpMethod.GET, b + "/audit-log", null));

    for (Call call : calls) {
      expectNotFound(call, shopA.ownerToken());
    }
    assertTenantBUntouched();
  }

  @Test
  void ownerOfACannotReachBsResourcesThroughTheirOwnSlug() throws Exception {
    String a = "/api/t/" + shopA.slug();
    List<Call> calls = List.of(
        new Call(HttpMethod.GET, a + "/services/" + shopB.service().getId(), null),
        new Call(HttpMethod.PUT, a + "/services/" + shopB.service().getId(), serviceJson()),
        new Call(HttpMethod.DELETE, a + "/services/" + shopB.service().getId(), null),
        new Call(HttpMethod.GET, a + "/staff/" + shopB.ownerMembership().getId(), null),
        new Call(HttpMethod.PATCH, a + "/staff/" + shopB.ownerMembership().getId(), "{\"active\":false}"),
        new Call(HttpMethod.PUT, a + "/staff/" + shopA.ownerMembership().getId() + "/services",
            "{\"serviceIds\":[\"" + shopB.service().getId() + "\"]}"),
        new Call(HttpMethod.GET, a + "/bookings/" + bookingB.getId(), null),
        new Call(HttpMethod.POST, a + "/bookings/" + bookingB.getId() + "/cancel", "{}"),
        new Call(HttpMethod.POST, a + "/bookings/" + bookingB.getId() + "/complete", null),
        new Call(HttpMethod.POST, a + "/bookings/" + bookingB.getId() + "/reschedule",
            "{\"startsAt\":\"" + TestFixtures.futureSlot(4, 10).toOffsetDateTime() + "\"}"),
        new Call(HttpMethod.POST, a + "/queue/" + queueEntryB + "/serve", null),
        new Call(HttpMethod.POST, a + "/queue/" + queueEntryB + "/skip", null),
        new Call(HttpMethod.PUT, a + "/blackouts/" + blackoutB, blackoutJson()),
        new Call(HttpMethod.DELETE, a + "/blackouts/" + blackoutB, null));

    for (Call call : calls) {
      expectNotFound(call, shopA.ownerToken());
    }
    assertTenantBUntouched();
  }

  @Test
  void listsOnlyEverContainTheCallersTenantData() throws Exception {
    fixtures.booking(shopA.tenant(), fixtures.user("customer@a.test"), shopA.ownerMembership(), shopA.service(),
        TestFixtures.futureSlot(3, 11).toInstant(), BookingStatus.CONFIRMED);
    String a = "/api/t/" + shopA.slug();
    LocalDate from = LocalDate.now(TestFixtures.MANILA);

    mockMvc.perform(request(HttpMethod.GET, a + "/bookings?from=" + from + "&to=" + from.plusDays(7))
            .header("Authorization", bearer(shopA.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].tenantSlug").value("tenant-a"));
    mockMvc.perform(request(HttpMethod.GET, a + "/services").header("Authorization", bearer(shopA.ownerToken())))
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].id").value(shopA.service().getId().toString()));
    mockMvc.perform(request(HttpMethod.GET, a + "/staff").header("Authorization", bearer(shopA.ownerToken())))
        .andExpect(jsonPath("$.length()").value(1));
    mockMvc.perform(request(HttpMethod.GET, a + "/queue").header("Authorization", bearer(shopA.ownerToken())))
        .andExpect(jsonPath("$.length()").value(0));
  }

  private void expectNotFound(Call call, String token) throws Exception {
    var builder = request(call.method(), call.path()).header("Authorization", bearer(token));
    if (call.body() != null) {
      builder.contentType(MediaType.APPLICATION_JSON).content(call.body());
    }
    int status = mockMvc.perform(builder).andReturn().getResponse().getStatus();
    assertThat(status).as("%s %s", call.method(), call.path()).isEqualTo(404);
  }

  private void assertTenantBUntouched() {
    UUID tenantB = shopB.tenant().getId();
    assertThat(jdbc.queryForObject("select name from tenant where id = ?", String.class, tenantB))
        .isEqualTo("Business tenant-b");
    assertThat(jdbc.queryForObject("select active from service_offering where id = ?", Boolean.class,
        shopB.service().getId())).isTrue();
    assertThat(jdbc.queryForObject("select status from booking where id = ?", String.class, bookingB.getId()))
        .isEqualTo(BookingStatus.CONFIRMED.name());
    assertThat(jdbc.queryForObject("select status from queue_entry where id = ?", String.class, queueEntryB))
        .isEqualTo(QueueStatus.WAITING.name());
    assertThat(jdbc.queryForObject("select count(*) from blackout where id = ?", Integer.class, blackoutB))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("select active from membership where id = ?", Boolean.class,
        shopB.ownerMembership().getId())).isTrue();
  }

  private static String serviceJson() {
    return "{\"name\":\"Hijack\",\"durationMinutes\":30,\"priceCentavos\":100}";
  }

  private static String blackoutJson() {
    return "{\"startsAt\":\"2030-01-01T09:00:00+08:00\",\"endsAt\":\"2030-01-01T10:00:00+08:00\"}";
  }

  private record Call(HttpMethod method, String path, String body) {
  }
}
