package com.queueup.queue;

import java.util.UUID;

/** Raised whenever a tenant's queue changes; broadcast to subscribers after the transaction commits. */
public record QueueChangedEvent(UUID tenantId, String tenantSlug) {
}
