package com.queueup.auth;

import com.queueup.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

/** Issues and verifies HS256 access tokens. Roles are never embedded: they are resolved per tenant from the DB. */
@Component
public class JwtService {

  private static final int MIN_SECRET_BYTES = 32;
  private static final String EMAIL_CLAIM = "email";

  private final SecretKey key;
  private final Duration accessTokenTtl;
  private final Clock clock;

  public JwtService(AppProperties properties, Clock clock) {
    this.key = Keys.hmacShaKeyFor(secretBytes(properties.security().jwtSecret()));
    this.accessTokenTtl = properties.security().accessTokenTtl();
    this.clock = clock;
  }

  public String issueAccessToken(UUID userId, String email) {
    Instant now = clock.instant();
    return Jwts.builder()
        .id(UUID.randomUUID().toString())
        .subject(userId.toString())
        .claim(EMAIL_CLAIM, email)
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(accessTokenTtl)))
        .signWith(key, Jwts.SIG.HS256)
        .compact();
  }

  public Optional<AuthUser> verify(String token) {
    try {
      Claims claims = Jwts.parser()
          .verifyWith(key)
          .clock(() -> Date.from(clock.instant()))
          .build()
          .parseSignedClaims(token)
          .getPayload();
      return Optional.of(new AuthUser(UUID.fromString(claims.getSubject()), claims.get(EMAIL_CLAIM, String.class)));
    } catch (JwtException | IllegalArgumentException ex) {
      return Optional.empty();
    }
  }

  public long accessTokenTtlSeconds() {
    return accessTokenTtl.toSeconds();
  }

  private static byte[] secretBytes(String secret) {
    if (secret == null || secret.isBlank()) {
      throw new IllegalStateException("JWT_SECRET must be configured");
    }
    byte[] bytes;
    try {
      bytes = Base64.getDecoder().decode(secret);
    } catch (IllegalArgumentException notBase64) {
      bytes = secret.getBytes(StandardCharsets.UTF_8);
    }
    if (bytes.length < MIN_SECRET_BYTES) {
      throw new IllegalStateException("JWT_SECRET must be at least 256 bits");
    }
    return bytes;
  }
}
