package com.queueup.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.queueup.config.AppProperties;
import com.queueup.common.web.ProblemResponseWriter;
import com.queueup.support.IntegrationTest;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Exercises the real filter with the production limit (5/min) by building a dedicated MockMvc around it, so the
 * shared test context can keep a high limit for the other suites.
 */
class RateLimitIT extends IntegrationTest {

  @Autowired
  private WebApplicationContext context;

  @Autowired
  private ProblemResponseWriter problemWriter;

  @Test
  void sixthLoginAttemptWithinAMinuteGets429() throws Exception {
    AppProperties production = new AppProperties("http://localhost:5173", false,
        new AppProperties.Security("x", Duration.ofMinutes(15), Duration.ofDays(7), 12, 5), null, null, null);
    MockMvc limited = MockMvcBuilders.webAppContextSetup(context)
        .addFilters(new AuthRateLimitFilter(new AuthRateLimiter(production), problemWriter))
        .build();
    String body = toJson(Map.of("email", "nobody@example.ph", "password", "Whatever123"));

    for (int attempt = 1; attempt <= 5; attempt++) {
      limited.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)
          .with(request -> {
            request.setRemoteAddr("203.0.113.7");
            return request;
          })).andExpect(status().isUnauthorized());
    }
    limited.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)
            .with(request -> {
              request.setRemoteAddr("203.0.113.7");
              return request;
            }))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.status").value(429));

    limited.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)
        .with(request -> {
          request.setRemoteAddr("198.51.100.9");
          return request;
        })).andExpect(status().isUnauthorized());
  }
}
