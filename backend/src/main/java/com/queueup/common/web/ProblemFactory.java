package com.queueup.common.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;

/** Builds {@link ApiError} bodies consistently for controllers, filters and security handlers. */
public final class ProblemFactory {

  private static final String TYPE_BASE = "https://queueup.app/problems/";

  private ProblemFactory() {
  }

  public static ApiError create(
      HttpStatus status, String title, String detail, HttpServletRequest request, List<ApiError.FieldError> errors) {
    return new ApiError(
        TYPE_BASE + status.name().toLowerCase(Locale.ROOT).replace('_', '-'),
        title,
        status.value(),
        detail,
        request.getRequestURI(),
        errors,
        MDC.get(TraceIdFilter.MDC_KEY));
  }

  public static ApiError create(HttpStatus status, String title, String detail, HttpServletRequest request) {
    return create(status, title, detail, request, List.of());
  }
}
