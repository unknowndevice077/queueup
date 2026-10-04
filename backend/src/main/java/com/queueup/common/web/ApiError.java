package com.queueup.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** RFC 7807 style problem response returned by every failing endpoint. */
@Schema(name = "ApiError", description = "RFC 7807 problem details")
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ApiError(
    String type,
    String title,
    int status,
    String detail,
    String instance,
    List<FieldError> errors,
    String traceId) {

  /** A single field level validation error. */
  @Schema(name = "ApiFieldError")
  public record FieldError(String field, String message) {
  }
}
