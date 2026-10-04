package com.queueup.queue;

public enum QueueStatus {
  WAITING,
  CALLED,
  SERVING,
  DONE,
  SKIPPED;

  public boolean isActive() {
    return this == WAITING || this == CALLED || this == SERVING;
  }
}
