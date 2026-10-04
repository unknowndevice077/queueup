package com.queueup.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.queueup.common.exception.UnauthorizedException;
import com.queueup.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");

  @Mock
  private RefreshTokenRepository repository;

  private RefreshTokenService service;

  @BeforeEach
  void setUp() {
    AppProperties properties = new AppProperties("http://localhost:5173", false,
        new AppProperties.Security("secret", Duration.ofMinutes(15), Duration.ofDays(7), 4, 5), null, null, null);
    service = new RefreshTokenService(repository, Clock.fixed(NOW, ZoneOffset.UTC), properties);
    lenient().when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  @Test
  void issueStoresOnlyTheHashWithSevenDayExpiry() {
    String raw = service.issue(UUID.randomUUID());

    ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
    verify(repository).save(saved.capture());
    assertThat(saved.getValue().getTokenHash()).isEqualTo(RefreshTokenService.hash(raw)).isNotEqualTo(raw);
    assertThat(saved.getValue().getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(7)));
  }

  @Test
  void rotateRevokesPresentedTokenAndIssuesSuccessorInSameFamily() {
    RefreshToken current = token(UUID.randomUUID(), NOW.plus(Duration.ofDays(1)), null);
    when(repository.findForUpdateByTokenHash(RefreshTokenService.hash("raw-1"))).thenReturn(Optional.of(current));

    RefreshTokenService.Rotation rotation = service.rotate("raw-1");

    assertThat(rotation.userId()).isEqualTo(current.getUserId());
    assertThat(rotation.refreshToken()).isNotBlank().isNotEqualTo("raw-1");
    assertThat(current.getRevokedAt()).isEqualTo(NOW);
    ArgumentCaptor<RefreshToken> successor = ArgumentCaptor.forClass(RefreshToken.class);
    verify(repository).save(successor.capture());
    assertThat(successor.getValue().getFamilyId()).isEqualTo(current.getFamilyId());
    assertThat(successor.getValue().getTokenHash()).isEqualTo(RefreshTokenService.hash(rotation.refreshToken()));
  }

  @Test
  void reusingARevokedTokenRevokesTheWholeFamily() {
    UUID familyId = UUID.randomUUID();
    RefreshToken revoked = token(familyId, NOW.plus(Duration.ofDays(1)), NOW.minusSeconds(60));
    when(repository.findForUpdateByTokenHash(anyString())).thenReturn(Optional.of(revoked));

    assertThatThrownBy(() -> service.rotate("stolen")).isInstanceOf(UnauthorizedException.class)
        .hasMessageContaining("reuse");
    verify(repository).revokeFamily(eq(familyId), eq(NOW));
    verify(repository, never()).save(any());
  }

  @Test
  void expiredTokenIsRejectedWithoutIssuingANewOne() {
    RefreshToken expired = token(UUID.randomUUID(), NOW.minusSeconds(1), null);
    when(repository.findForUpdateByTokenHash(anyString())).thenReturn(Optional.of(expired));

    assertThatThrownBy(() -> service.rotate("old")).isInstanceOf(UnauthorizedException.class)
        .hasMessageContaining("expired");
    verify(repository, never()).save(any());
  }

  @Test
  void unknownTokenIsRejected() {
    when(repository.findForUpdateByTokenHash(anyString())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.rotate("nope")).isInstanceOf(UnauthorizedException.class);
  }

  private static RefreshToken token(UUID familyId, Instant expiresAt, Instant revokedAt) {
    RefreshToken token = new RefreshToken();
    token.setUserId(UUID.randomUUID());
    token.setFamilyId(familyId);
    token.setTokenHash("hash");
    token.setExpiresAt(expiresAt);
    token.setRevokedAt(revokedAt);
    return token;
  }
}
