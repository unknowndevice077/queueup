package com.queueup.common.exception;

public class SlotUnavailableException extends ConflictException {

  public SlotUnavailableException() {
    super("Slot no longer available");
  }
}
