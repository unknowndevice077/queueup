package com.queueup.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.queueup.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthFlowIT extends IntegrationTest {

  private static final String PASSWORD = "Sup3rSecret!";

  @Test
  void registerLoginMeRefreshLogoutEndToEnd() throws Exception {
    JsonNode registered = json(mockMvc.perform(post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "Juan@Example.PH", "password", PASSWORD, "fullName", "Juan Cruz")))
        ).andExpect(status().isCreated())
        .andExpect(jsonPath("$.user.email").value("juan@example.ph"))
        .andExpect(jsonPath("$.accessToken").isNotEmpty())
        .andReturn());
    assertThat(jdbc.queryForObject("select password_hash from app_user", String.class)).startsWith("$2");

    JsonNode login = json(mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "juan@example.ph", "password", PASSWORD))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.expiresIn").value(900))
        .andReturn());

    mockMvc.perform(get("/api/me").header("Authorization", bearer(login.get("accessToken").asText())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.user.fullName").value("Juan Cruz"))
        .andExpect(jsonPath("$.memberships").isEmpty());

    String firstRefresh = login.get("refreshToken").asText();
    JsonNode refreshed = json(mockMvc.perform(post("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", firstRefresh))))
        .andExpect(status().isOk())
        .andReturn());
    String secondRefresh = refreshed.get("refreshToken").asText();
    assertThat(secondRefresh).isNotEqualTo(firstRefresh);

    mockMvc.perform(post("/api/auth/logout")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", secondRefresh))))
        .andExpect(status().isNoContent());
    mockMvc.perform(post("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", secondRefresh))))
        .andExpect(status().isUnauthorized());
    assertThat(registered.get("user").get("id").asText()).isNotBlank();
  }

  @Test
  void reusingARotatedRefreshTokenRevokesTheWholeFamily() throws Exception {
    fixtures.user("reuse@example.ph");
    JsonNode login = json(mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "reuse@example.ph", "password", "Password123"))))
        .andExpect(status().isOk()).andReturn());
    String original = login.get("refreshToken").asText();
    String rotated = json(mockMvc.perform(post("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", original))))
        .andExpect(status().isOk()).andReturn()).get("refreshToken").asText();

    mockMvc.perform(post("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", original))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("reuse")));

    mockMvc.perform(post("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("refreshToken", rotated))))
        .andExpect(status().isUnauthorized());
    assertThat(jdbc.queryForObject("select count(*) from refresh_token where revoked_at is null", Integer.class))
        .isZero();
  }

  @Test
  void wrongPasswordAndDuplicateEmail() throws Exception {
    fixtures.user("taken@example.ph");

    mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "taken@example.ph", "password", "WrongPass99"))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.detail").value("Invalid email or password"));
    mockMvc.perform(post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "taken@example.ph", "password", PASSWORD, "fullName", "Dup"))))
        .andExpect(status().isConflict());
  }

  @Test
  void validationErrorsUseTheProblemDetailsFormat() throws Exception {
    mockMvc.perform(post("/api/auth/register")
            .header("X-Trace-Id", "trace-abc-12345")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "not-an-email", "password", "short", "fullName", ""))))
        .andExpect(status().isBadRequest())
        .andExpect(header().string("Content-Type", "application/problem+json"))
        .andExpect(header().string("X-Trace-Id", "trace-abc-12345"))
        .andExpect(jsonPath("$.type").value("https://queueup.app/problems/bad-request"))
        .andExpect(jsonPath("$.title").value("Validation failed"))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.instance").value("/api/auth/register"))
        .andExpect(jsonPath("$.traceId").value("trace-abc-12345"))
        .andExpect(jsonPath("$.errors[?(@.field == 'email')]").exists())
        .andExpect(jsonPath("$.errors[?(@.field == 'password')]").exists())
        .andExpect(jsonPath("$.errors[?(@.field == 'fullName')]").exists());
  }

  @Test
  void passwordPolicyRequiresLettersAndNumbers() throws Exception {
    mockMvc.perform(post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", "a@b.ph", "password", "onlyletterslong", "fullName", "A"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("password"));
  }

  @Test
  void protectedEndpointsReturn401ProblemWithoutToken() throws Exception {
    mockMvc.perform(get("/api/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(jsonPath("$.traceId").isNotEmpty());
    mockMvc.perform(get("/api/me").header("Authorization", "Bearer not.a.jwt"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void openApiHealthAndActuatorLockdown() throws Exception {
    mockMvc.perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/t/{slug}/bookings'].post").exists())
        .andExpect(jsonPath("$.paths['/api/webhooks/paymongo'].post").exists())
        .andExpect(jsonPath("$.components.schemas.BookingResponse").exists())
        .andExpect(jsonPath("$.components.schemas.ApiError").exists());
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
    mockMvc.perform(get("/actuator/env")).andExpect(status().is4xxClientError());
  }
}
