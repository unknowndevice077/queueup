package com.queueup.support;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueup.payment.PaymentGateway;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base for integration tests: one PostgreSQL 16 container shared by every test class (singleton pattern), one
 * cached Spring context, and a clean database before each test. Email and the payment provider are mocked at
 * their outermost boundary only.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTest {

  @ServiceConnection
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  static {
    POSTGRES.start();
  }

  private static final String TRUNCATE_ALL = """
      TRUNCATE audit_log, notification_log, webhook_event, payment, queue_counter, queue_entry, booking, blackout,
               working_hours, staff_service, service_offering, refresh_token, membership, app_user, tenant,
               waitlist_signup CASCADE
      """;

  @Autowired
  protected MockMvc mockMvc;

  @Autowired
  protected ObjectMapper objectMapper;

  @Autowired
  protected JdbcTemplate jdbc;

  @Autowired
  protected TestFixtures fixtures;

  @MockitoBean
  protected JavaMailSender mailSender;

  @MockitoBean
  protected PaymentGateway paymentGateway;

  @BeforeEach
  void resetDatabaseAndMocks() {
    jdbc.execute(TRUNCATE_ALL);
    when(mailSender.createMimeMessage()).thenAnswer(inv -> new MimeMessage(Session.getInstance(new Properties())));
    when(paymentGateway.isConfigured()).thenReturn(true);
    when(paymentGateway.createCheckout(any())).thenAnswer(inv -> {
      PaymentGateway.CheckoutRequest request = inv.getArgument(0);
      return new PaymentGateway.CheckoutSession("cs_test_" + request.paymentId(),
          "https://checkout.paymongo.com/cs_test_" + request.paymentId());
    });
  }

  protected JsonNode json(MvcResult result) throws Exception {
    return objectMapper.readTree(result.getResponse().getContentAsString());
  }

  protected String toJson(Object value) throws Exception {
    return objectMapper.writeValueAsString(value);
  }

  protected static String bearer(String token) {
    return "Bearer " + token;
  }
}
