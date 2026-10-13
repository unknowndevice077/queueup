package com.queueup.waitlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.support.IntegrationTest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class WaitlistIT extends IntegrationTest {

  private ResultActions join(Map<String, Object> overrides) throws Exception {
    Map<String, Object> body = new HashMap<>(Map.of(
        "kind", "FAMILY",
        "fullName", "Maricel Santos",
        "email", "maricel@example.com",
        "country", "Saudi Arabia",
        "familyLocation", "Ormoc City, Leyte",
        "relation", "Parent",
        "services", List.of("Dental", "Check-up"),
        "frequency", "Every few months",
        "source", "fb-ofw-leyte",
        "consent", true));
    body.putAll(overrides);
    return mockMvc.perform(post("/api/public/waitlist").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(body)));
  }

  @Test
  void signupsGetTheirPlaceInLineAndRepeatsUpdateInsteadOfDuplicating() throws Exception {
    join(Map.of()).andExpect(status().isCreated())
        .andExpect(jsonPath("$.position").value(1))
        .andExpect(jsonPath("$.total").value(1));
    join(Map.of("email", "jun@example.com", "fullName", "Jun Reyes")).andExpect(status().isCreated())
        .andExpect(jsonPath("$.position").value(2));

    join(Map.of("email", "MARICEL@example.com", "country", "Qatar", "source", "fb-other"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.position").value(1))
        .andExpect(jsonPath("$.total").value(2));

    Map<String, Object> row = jdbc.queryForMap(
        "SELECT country, source, services FROM waitlist_signup WHERE email = 'maricel@example.com'");
    assertThat(row.get("country")).isEqualTo("Qatar");
    assertThat(row.get("source")).as("first source is kept for attribution").isEqualTo("fb-ofw-leyte");
    assertThat(row.get("services")).isEqualTo("Dental;Check-up");
  }

  @Test
  void clinicsAreCountedOnTheirOwnListAndNeedAClinicName() throws Exception {
    join(Map.of()).andExpect(status().isCreated());
    join(Map.of("kind", "CLINIC", "email", "frontdesk@clinic.ph")).andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("clinicNamePresent"));
    join(Map.of("kind", "CLINIC", "email", "frontdesk@clinic.ph", "clinicName", "Ormoc Smile Dental"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.position").value(1))
        .andExpect(jsonPath("$.total").value(1));
  }

  @Test
  void consentAndAValidEmailAreRequired() throws Exception {
    join(Map.of("consent", false)).andExpect(status().isBadRequest());
    join(Map.of("email", "not-an-email")).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("SELECT count(*) FROM waitlist_signup", Integer.class)).isZero();
  }

  @Test
  void exportNeedsTheAdminTokenAndNeutralisesFormulas() throws Exception {
    join(Map.of("fullName", "=HYPERLINK(\"http://evil\")")).andExpect(status().isCreated());

    mockMvc.perform(get("/api/admin/waitlist.csv")).andExpect(status().isNotFound());
    mockMvc.perform(get("/api/admin/waitlist.csv").header("X-Admin-Token", "wrong"))
        .andExpect(status().isNotFound());

    String csv = mockMvc.perform(get("/api/admin/waitlist.csv").header("X-Admin-Token", "test-admin-token"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    assertThat(csv).startsWith("joined_at,kind,full_name,email");
    assertThat(csv).contains("FAMILY").contains("maricel@example.com").contains("\"'=HYPERLINK");
  }
}
