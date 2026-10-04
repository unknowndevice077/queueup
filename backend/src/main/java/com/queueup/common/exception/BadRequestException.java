package com.queueup.common.exception;

import java.util.List;
import org.springframework.http.HttpStatus;

public class BadRequestException extends ApiException {

  public BadRequestException(String detail) {
    super(HttpStatus.BAD_REQUEST, "Bad Request", detail);
  }

  public BadRequestException(String field, String message) {
    super(HttpStatus.BAD_REQUEST, "Validation failed", message, List.of(new FieldViolation(field, message)));
  }
}
