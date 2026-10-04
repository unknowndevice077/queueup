package com.queueup.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class DatabaseUrlEnvironmentPostProcessorTest {

  @Test
  void convertsRenderStyleUrlIntoJdbcProperties() {
    Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.convert(
        "postgres://queueup:s3cret@dpg-abc.oregon-postgres.render.com/queueup_db?sslmode=require");

    assertThat(props)
        .containsEntry("spring.datasource.url",
            "jdbc:postgresql://dpg-abc.oregon-postgres.render.com:5432/queueup_db?sslmode=require")
        .containsEntry("spring.datasource.username", "queueup")
        .containsEntry("spring.datasource.password", "s3cret");
  }

  @Test
  void keepsExplicitPort() {
    assertThat(DatabaseUrlEnvironmentPostProcessor.convert("postgresql://u:p@db:6543/app"))
        .containsEntry("spring.datasource.url", "jdbc:postgresql://db:6543/app");
  }

  @Test
  void ignoresUrlsItDoesNotUnderstand() {
    assertThat(DatabaseUrlEnvironmentPostProcessor.convert("mysql://x")).isEmpty();
  }
}
