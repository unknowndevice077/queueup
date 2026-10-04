package com.queueup.auth;

import java.util.UUID;

/** Authenticated principal extracted from a verified access token. */
public record AuthUser(UUID id, String email) {
}
