package com.queueup.common.exception;

import java.util.List;
import org.springframework.http.HttpStatus;

/** Base for exceptions that map directly onto an RFC 7807 problem response. */
public abstract class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String title;
  private final List<FieldViolation> violations;

  protected ApiException(HttpStatus status, String title, String detail) {
    this(status, title, detail, List.of());
  }

  protected ApiException(HttpStatus status, String title, String detail, List<FieldViolation> violations) {
    super(detail);
    this.status = status;
    this.title = title;
    this.violations = List.copyOf(violations);
  }

  public HttpStatus getStatus() {
    return status;
  }

  public String getTitle() {
    return title;
  }

  public List<FieldViolation> getViolations() {
    return violations;
  }

  /** A single invalid field. */
  public record FieldViolation(String field, String message) {
  }
}
