package com.queueup.auth;

import com.queueup.common.exception.UnauthorizedException;
import com.queueup.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque, rotating refresh tokens. Only a SHA-256 hash is stored. Every refresh revokes the presented
 * token and issues a successor in the same family; presenting an already revoked token is treated as
 * theft and revokes the entire family.
 */
@Service
public class RefreshTokenService {

  private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
  private static final int TOKEN_BYTES = 32;

  private final RefreshTokenRepository repository;
  private final Clock clock;
  private final Duration ttl;
  private final SecureRandom random = new SecureRandom();

  public RefreshTokenService(RefreshTokenRepository repository, Clock clock, AppProperties properties) {
    this.repository = repository;
    this.clock = clock;
    this.ttl = properties.security().refreshTokenTtl();
  }

  @Transactional
  public String issue(UUID userId) {
    return createToken(userId, UUID.randomUUID()).rawToken();
  }

  @Transactional(noRollbackFor = UnauthorizedException.class)
  public Rotation rotate(String rawToken) {
    RefreshToken current = repository.findForUpdateByTokenHash(hash(rawToken))
        .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
    Instant now = clock.instant();
    if (current.isRevoked()) {
      int revoked = repository.revokeFamily(current.getFamilyId(), now);
      log.warn("Refresh token reuse detected for user {}; revoked {} tokens in family", current.getUserId(), revoked);
      throw new UnauthorizedException("Refresh token reuse detected; please sign in again");
    }
    if (current.isExpired(now)) {
      throw new UnauthorizedException("Refresh token expired");
    }
    NewToken successor = createToken(current.getUserId(), current.getFamilyId());
    current.setRevokedAt(now);
    current.setReplacedBy(successor.entity().getId());
    return new Rotation(current.getUserId(), successor.rawToken());
  }

  @Transactional
  public void revokeFamilyOf(String rawToken) {
    repository.findByTokenHash(hash(rawToken))
        .ifPresent(token -> repository.revokeFamily(token.getFamilyId(), clock.instant()));
  }

  private NewToken createToken(UUID userId, UUID familyId) {
    byte[] bytes = new byte[TOKEN_BYTES];
    random.nextBytes(bytes);
    String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    RefreshToken token = new RefreshToken();
    token.setUserId(userId);
    token.setFamilyId(familyId);
    token.setTokenHash(hash(raw));
    token.setExpiresAt(clock.instant().plus(ttl));
    return new NewToken(repository.save(token), raw);
  }

  static String hash(String rawToken) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 unavailable", ex);
    }
  }

  /** Result of a successful rotation. */
  public record Rotation(UUID userId, String refreshToken) {
  }

  private record NewToken(RefreshToken entity, String rawToken) {
  }
}
