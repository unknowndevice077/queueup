package com.queueup.common.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

  public NotFoundException(String detail) {
    super(HttpStatus.NOT_FOUND, "Not Found", detail);
  }

  public static NotFoundException of(String resource) {
    return new NotFoundException(resource + " not found");
  }
}
