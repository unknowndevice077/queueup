package com.queueup.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.support.IntegrationTest;
import com.queueup.support.TestFixtures;
import com.queueup.support.TestFixtures.Shop;
import com.queueup.user.AppUser;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Happy paths for setting a business up through the API: services, staff, schedules and blackouts. */
class BusinessManagementIT extends IntegrationTest {

  @Test
  void anyUserCanCreateABusinessAndBecomesItsOwner() throws Exception {
    AppUser founder = fixtures.user("founder@new.test");
    String token = fixtures.token(founder);

    mockMvc.perform(post("/api/tenants").header("Authorization", bearer(token))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Bagong Salon", "slug", "bagong-salon", "timezone", "Asia/Manila"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.slug").value("bagong-salon"))
        .andExpect(jsonPath("$.currency").value("PHP"));
    mockMvc.perform(get("/api/me").header("Authorization", bearer(token)))
        .andExpect(jsonPath("$.memberships[0].tenantSlug").value("bagong-salon"))
        .andExpect(jsonPath("$.memberships[0].role").value("OWNER"));
    mockMvc.perform(post("/api/tenants").header("Authorization", bearer(token))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Copy", "slug", "bagong-salon"))))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/tenants").header("Authorization", bearer(token))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Bad", "slug", "Bad Slug!", "timezone", "Mars/Olympus"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors.length()").value(2));
  }

  @Test
  void ownerManagesServicesAndThePublicSeesOnlyActiveOnes() throws Exception {
    Shop shop = fixtures.shop("svc");
    String id = json(mockMvc.perform(post("/api/t/svc/services").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Beard Trim", "durationMinutes", 20, "priceCentavos", 15_000))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.bufferMinutes").value(0))
        .andReturn()).get("id").asText();
    mockMvc.perform(put("/api/t/svc/services/" + id).header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Beard Sculpt", "durationMinutes", 25, "bufferMinutes", 5,
                "priceCentavos", 18_000))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Beard Sculpt"));
    mockMvc.perform(post("/api/t/svc/services").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("name", "Too long", "durationMinutes", 600, "priceCentavos", 1))))
        .andExpect(status().isBadRequest());

    mockMvc.perform(get("/api/public/tenants/svc/services")).andExpect(jsonPath("$.length()").value(2));
    mockMvc.perform(delete("/api/t/svc/services/" + id).header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isNoContent());
    mockMvc.perform(get("/api/public/tenants/svc")).andExpect(status().isOk())
        .andExpect(jsonPath("$.services.length()").value(1))
        .andExpect(jsonPath("$.staff[0].name").value("owner"));
    mockMvc.perform(get("/api/t/svc/services/" + id).header("Authorization", bearer(shop.ownerToken())))
        .andExpect(jsonPath("$.active").value(false));
    mockMvc.perform(get("/api/public/tenants/does-not-exist")).andExpect(status().isNotFound());
  }

  @Test
  void ownerInvitesStaffAssignsServicesAndSetsAWeeklyScheduleWithLunchBreak() throws Exception {
    Shop shop = fixtures.shop("team");
    fixtures.user("barber@team.test");

    String staffId = json(mockMvc.perform(post("/api/t/team/staff").header("Authorization",
            bearer(shop.ownerToken())).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"Barber@Team.test\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.role").value("STAFF"))
        .andReturn()).get("id").asText();
    mockMvc.perform(post("/api/t/team/staff").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"barber@team.test\"}"))
        .andExpect(status().isConflict());
    mockMvc.perform(post("/api/t/team/staff").header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ghost@team.test\"}"))
        .andExpect(status().isNotFound());

    mockMvc.perform(put("/api/t/team/staff/" + staffId + "/services").header("Authorization",
            bearer(shop.ownerToken())).contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("serviceIds", List.of(shop.service().getId())))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.serviceIds[0]").value(shop.service().getId().toString()));
    mockMvc.perform(put("/api/t/team/staff/" + staffId + "/working-hours").header("Authorization",
            bearer(shop.ownerToken())).contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"ranges":[{"dayOfWeek":1,"startTime":"13:00","endTime":"18:00"},
                           {"dayOfWeek":1,"startTime":"09:00","endTime":"12:00"}]}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workingHours.length()").value(2))
        .andExpect(jsonPath("$.workingHours[0].startTime").value(org.hamcrest.Matchers.startsWith("09:00")));
    mockMvc.perform(put("/api/t/team/staff/" + staffId + "/working-hours").header("Authorization",
            bearer(shop.ownerToken())).contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"ranges":[{"dayOfWeek":1,"startTime":"09:00","endTime":"12:00"},
                           {"dayOfWeek":1,"startTime":"11:00","endTime":"18:00"}]}
                """))
        .andExpect(status().isBadRequest());

    mockMvc.perform(get("/api/t/team/staff").header("Authorization", bearer(shop.ownerToken())))
        .andExpect(jsonPath("$.length()").value(2));
    mockMvc.perform(patch("/api/t/team/staff/" + staffId).header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"OWNER\"}"))
        .andExpect(jsonPath("$.role").value("OWNER"));
    mockMvc.perform(delete("/api/t/team/staff/" + staffId).header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isNoContent());
    assertThat(jdbc.queryForObject("select count(*) from audit_log where action like 'STAFF_%'", Integer.class))
        .isEqualTo(5);
  }

  @Test
  void ownerManagesBlackoutsThatRemoveAvailability() throws Exception {
    Shop shop = fixtures.shop("closed");
    var day = TestFixtures.futureSlot(4, 0);
    String id = json(mockMvc.perform(post("/api/t/closed/blackouts").header("Authorization",
            bearer(shop.ownerToken())).contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(day),
                "endsAt", TestFixtures.iso(day.plusDays(1)), "reason", "Holiday"))))
        .andExpect(status().isCreated())
        .andReturn()).get("id").asText();

    mockMvc.perform(get("/api/public/tenants/closed/availability?serviceId=" + shop.service().getId()
            + "&date=" + day.toLocalDate()))
        .andExpect(jsonPath("$[0].slots.length()").value(0));
    mockMvc.perform(put("/api/t/closed/blackouts/" + id).header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(day.plusHours(12)),
                "endsAt", TestFixtures.iso(day.plusHours(13))))))
        .andExpect(status().isOk());
    mockMvc.perform(put("/api/t/closed/blackouts/" + id).header("Authorization", bearer(shop.ownerToken()))
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("startsAt", TestFixtures.iso(day.plusHours(13)),
                "endsAt", TestFixtures.iso(day.plusHours(12))))))
        .andExpect(status().isBadRequest());
    mockMvc.perform(get("/api/t/closed/blackouts").header("Authorization", bearer(shop.ownerToken())))
        .andExpect(jsonPath("$.totalElements").value(1));
    mockMvc.perform(delete("/api/t/closed/blackouts/" + id).header("Authorization", bearer(shop.ownerToken())))
        .andExpect(status().isNoContent());
    mockMvc.perform(get("/api/public/tenants/closed/availability?serviceId=" + shop.service().getId()
            + "&date=" + day.toLocalDate()))
        .andExpect(jsonPath("$[0].slots.length()").value(31));
  }
}
