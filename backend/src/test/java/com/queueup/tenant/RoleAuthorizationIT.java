package com.queueup.tenant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.booking.Booking;
import com.queueup.booking.BookingStatus;
import com.queueup.common.tenant.TenantRole;
import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import com.queueup.user.Membership;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class RoleAuthorizationIT extends IntegrationTest {

  private Shop shop;
  private String staffToken;
  private Membership staffMembership;
  private AppUser customer;
  private String customerToken;
  private Booking customerBooking;
  private Booking otherCustomersBooking;

  @BeforeEach
  void setUp() {
    shop = fixtures.shop("roles");
    AppUser staffUser = fixtures.user("staff@roles.test");
    staffMembership = fixtures.member(shop.tenant(), staffUser, TenantRole.STAFF);
    staffToken = fixtures.token(staffUser);
    customer = fixtures.user("customer@roles.test");
    customerToken = fixtures.token(customer);
    customerBooking = fixtures.booking(shop.tenant(), customer, shop.ownerMembership(), shop.service(),
        TestFixtures.futureSlot(3, 10).toInstant(), BookingStatus.CONFIRMED);
    otherCustomersBooking = fixtures.booking(shop.tenant(), fixtures.user("other@roles.test"),
        shop.ownerMembership(), shop.service(), TestFixtures.futureSlot(3, 11).toInstant(), BookingStatus.CONFIRMED);
  }

  @Test
  void staffCannotChangeSettingsServicesOrSeeAnalytics() throws Exception {
    mockMvc.perform(patch("/api/t/roles/settings").header("Authorization", bearer(staffToken))
            .contentType(MediaType.APPLICATION_JSON).content("{\"bookingLeadTimeMinutes\":0}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.status").value(403));
    mockMvc.perform(post("/api/t/roles/services").header("Authorization", bearer(staffToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"X\",\"durationMinutes\":30,\"priceCentavos\":100}"))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/t/roles/analytics/summary").header("Authorization", bearer(staffToken)))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/api/t/roles/audit-log").header("Authorization", bearer(staffToken)))
        .andExpect(status().isForbidden());
  }

  @Test
  void staffCanWorkTheCalendarAndManageOnlyTheirOwnBlackouts() throws Exception {
    mockMvc.perform(get("/api/t/roles/bookings").header("Authorization", bearer(staffToken)))
        .andExpect(status().isOk());
    mockMvc.perform(get("/api/t/roles/settings").header("Authorization", bearer(staffToken)))
        .andExpect(status().isOk());

    String start = TestFixtures.iso(TestFixtures.futureSlot(5, 9));
    String end = TestFixtures.iso(TestFixtures.futureSlot(5, 12));
    mockMvc.perform(post("/api/t/roles/blackouts").header("Authorization", bearer(staffToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("membershipId", staffMembership.getId(), "startsAt", start, "endsAt", end))))
        .andExpect(status().isCreated());
    mockMvc.perform(post("/api/t/roles/blackouts").header("Authorization", bearer(staffToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("membershipId", shop.ownerMembership().getId(), "startsAt", start,
                "endsAt", end))))
        .andExpect(status().isForbidden());
    mockMvc.perform(post("/api/t/roles/blackouts").header("Authorization", bearer(staffToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", start, "endsAt", end))))
        .andExpect(status().isForbidden());
  }

  @Test
  void ownerCanChangeSettingsAndItIsAudited() throws Exception {
    mockMvc.perform(patch("/api/t/roles/settings").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"depositRequired\":true,\"depositPercent\":25,\"cancellationWindowHours\":12}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.depositPercent").value(25));
    mockMvc.perform(get("/api/t/roles/audit-log").header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].action").value("SETTINGS_UPDATED"))
        .andExpect(jsonPath("$.content[0].details.depositPercent").value(25));
  }

  @Test
  void depositRequiresAPositivePercent() throws Exception {
    mockMvc.perform(patch("/api/t/roles/settings").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"depositRequired\":true,\"depositPercent\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("depositPercent"));
  }

  @Test
  void customerCannotSeeTheBusinessCalendarOrOtherCustomersBookings() throws Exception {
    mockMvc.perform(get("/api/t/roles/bookings").header("Authorization", bearer(customerToken)))
        .andExpect(status().isNotFound());
    mockMvc.perform(get("/api/t/roles/bookings/" + otherCustomersBooking.getId())
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isNotFound());
    mockMvc.perform(post("/api/t/roles/bookings/" + otherCustomersBooking.getId() + "/cancel")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isNotFound());
    mockMvc.perform(post("/api/t/roles/bookings/" + customerBooking.getId() + "/complete")
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isNotFound());
  }

  @Test
  void customerSeesOnlyTheirOwnBookings() throws Exception {
    mockMvc.perform(get("/api/t/roles/bookings/" + customerBooking.getId())
            .header("Authorization", bearer(customerToken)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.customerId").value(customer.getId().toString()));
    mockMvc.perform(get("/api/me/bookings").header("Authorization", bearer(customerToken)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].id").value(customerBooking.getId().toString()))
        .andExpect(jsonPath("$.content[0].tenantName").value("Business roles"));
  }

  @Test
  void ownerCannotRemoveTheLastOwner() throws Exception {
    mockMvc.perform(patch("/api/t/roles/staff/" + shop.ownerMembership().getId())
            .header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"STAFF\"}"))
        .andExpect(status().isConflict());
  }
}
