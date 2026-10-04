package com.queueup.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI queueUpOpenApi() {
    return new OpenAPI()
        .info(new Info()
            .title("QueueUp API")
            .version("v1")
            .description("Multi-tenant booking and walk-in queue management for small businesses in the Philippines. "
                + "Tenant-scoped endpoints live under /api/t/{slug}; public endpoints under /api/public. "
                + "Errors follow RFC 7807. Money is in centavos; timestamps are ISO-8601.")
            .license(new License().name("MIT")))
        .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
            .type(SecurityScheme.Type.HTTP)
            .scheme("bearer")
            .bearerFormat("JWT")));
  }
}
