package com.queueup.config;

import com.queueup.common.web.ApiError;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  private static final Map<String, String> ERROR_RESPONSES = Map.of(
      "400", "Validation failed (RFC 7807 body with field errors)",
      "401", "Missing or invalid access token",
      "403", "Authenticated but not allowed (e.g. STAFF on an OWNER action)",
      "404", "Not found, or not visible to the caller (tenant isolation)",
      "409", "Conflict, e.g. the slot was just taken");

  @Bean
  public OpenAPI queueUpOpenApi() {
    return new OpenAPI()
        .info(new Info()
            .title("QueueUp API")
            .version("v1")
            .description("Multi-tenant booking and walk-in queue management for small businesses in the Philippines. "
                + "Tenant-scoped endpoints live under /api/t/{slug}; public endpoints under /api/public. "
                + "Errors follow RFC 7807. Money is in centavos; timestamps are ISO-8601 with offset.")
            .license(new License().name("MIT")))
        .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
            .type(SecurityScheme.Type.HTTP)
            .scheme("bearer")
            .bearerFormat("JWT")));
  }

  /** Registers the ApiError schema and documents the shared error responses on every operation. */
  @Bean
  public OpenApiCustomizer problemDetailsCustomizer() {
    return openApi -> {
      ModelConverters.getInstance().readAll(ApiError.class).forEach(openApi.getComponents()::addSchemas);
      Schema<?> errorRef = new Schema<>().$ref("#/components/schemas/ApiError");
      Content problemJson = new Content().addMediaType("application/problem+json", new MediaType().schema(errorRef));
      openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation ->
          ERROR_RESPONSES.forEach((code, description) -> operation.getResponses().putIfAbsent(code,
              new ApiResponse().description(description).content(problemJson)))));
    };
  }
}
