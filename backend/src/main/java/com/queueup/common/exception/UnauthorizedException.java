package com.queueup.common.exception;

import org.springframework.http.HttpStatus;

public class UnauthorizedException extends ApiException {

  public UnauthorizedException(String detail) {
    super(HttpStatus.UNAUTHORIZED, "Unauthorized", detail);
  }
}
