package com.queueup.config;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Accepts DATABASE_URL either as a JDBC URL or in the libpq form that hosts such as Render provide
 * ({@code postgres://user:pass@host:5432/db}) and converts the latter into Spring datasource properties.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

  private static final String SOURCE_NAME = "queueupDatabaseUrl";

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    String url = environment.getProperty("DATABASE_URL");
    if (url == null || url.startsWith("jdbc:")) {
      return;
    }
    Map<String, Object> converted = convert(url);
    if (!converted.isEmpty()) {
      environment.getPropertySources().addFirst(new MapPropertySource(SOURCE_NAME, converted));
    }
  }

  static Map<String, Object> convert(String url) {
    Map<String, Object> properties = new HashMap<>();
    if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
      return properties;
    }
    URI uri = URI.create(url);
    int port = uri.getPort() == -1 ? 5432 : uri.getPort();
    String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
    properties.put("spring.datasource.url", "jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getPath() + query);
    String userInfo = uri.getUserInfo();
    if (userInfo != null && !userInfo.isEmpty()) {
      String[] parts = userInfo.split(":", 2);
      properties.put("spring.datasource.username", parts[0]);
      if (parts.length > 1) {
        properties.put("spring.datasource.password", parts[1]);
      }
    }
    return properties;
  }

  @Override
  public int getOrder() {
    return Ordered.LOWEST_PRECEDENCE;
  }
}
