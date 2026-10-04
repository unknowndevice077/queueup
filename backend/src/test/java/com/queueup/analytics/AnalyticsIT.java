package com.queueup.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.booking.BookingStatus;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AnalyticsIT extends IntegrationTest {

  private Shop shop;
  private LocalDate day;

  @BeforeEach
  void seedHistory() {
    shop = fixtures.shop("stats");
    AppUser customer = fixtures.user("ana@stats.test");
    day = LocalDate.now(TestFixtures.MANILA).minusDays(3);
    ZonedDateTime nine = day.atTime(9, 0).atZone(TestFixtures.MANILA);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(), nine.toInstant(),
        BookingStatus.COMPLETED);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(), nine.plusHours(1).toInstant(),
        BookingStatus.COMPLETED);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(), nine.plusHours(2).toInstant(),
        BookingStatus.NO_SHOW);
    fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(), nine.plusHours(3).toInstant(),
        BookingStatus.CANCELLED);
  }

  @Test
  void summaryAggregatesPerTenantLocalDay() throws Exception {
    mockMvc.perform(get("/api/t/stats/analytics/summary?from=" + day.minusDays(1) + "&to=" + day.plusDays(1))
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timezone").value("Asia/Manila"))
        .andExpect(jsonPath("$.bookingsPerDay.length()").value(3))
        .andExpect(jsonPath("$.bookingsPerDay[1].date").value(day.toString()))
        .andExpect(jsonPath("$.bookingsPerDay[1].total").value(4))
        .andExpect(jsonPath("$.bookingsPerDay[0].total").value(0))
        .andExpect(jsonPath("$.totals.completed").value(2))
        .andExpect(jsonPath("$.totals.cancelled").value(1))
        .andExpect(jsonPath("$.totals.noShow").value(1))
        .andExpect(jsonPath("$.totals.noShowRate").value(0.3333))
        .andExpect(jsonPath("$.totals.revenueCentavos").value(50_000))
        .andExpect(jsonPath("$.topServices[0].name").value("Haircut"))
        .andExpect(jsonPath("$.topServices[0].bookings").value(3))
        .andExpect(jsonPath("$.busiestHours[0].hour").value(9));
  }

  @Test
  void csvExportContainsEveryBookingInTheRange() throws Exception {
    String csv = mockMvc.perform(get("/api/t/stats/analytics/export.csv?from=" + day + "&to=" + day)
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Disposition",
            org.hamcrest.Matchers.containsString("queueup-stats-bookings.csv")))
        .andReturn().getResponse().getContentAsString();

    assertThat(csv.lines()).hasSize(5);
    assertThat(csv.lines().findFirst().orElseThrow()).startsWith("booking_id,starts_at_local");
    assertThat(csv).contains(day + " 09:00").contains("250.00").contains("NO_SHOW");
  }

  @Test
  void rejectsInvertedOrHugeRanges() throws Exception {
    mockMvc.perform(get("/api/t/stats/analytics/summary?from=2026-02-01&to=2026-01-01")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isBadRequest());
    mockMvc.perform(get("/api/t/stats/analytics/summary?from=2020-01-01&to=2026-01-01")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isBadRequest());
    mockMvc.perform(get("/api/t/stats/analytics/summary?from=not-a-date")
            .header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("from"));
  }
}
