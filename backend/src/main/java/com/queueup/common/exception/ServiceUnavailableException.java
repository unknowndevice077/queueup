package com.queueup.common.exception;

import org.springframework.http.HttpStatus;

public class ServiceUnavailableException extends ApiException {

  public ServiceUnavailableException(String detail) {
    super(HttpStatus.SERVICE_UNAVAILABLE, "Service Unavailable", detail);
  }
}
