package com.queueup.auth;

import com.queueup.auth.dto.AuthResponse;
import com.queueup.auth.dto.LoginRequest;
import com.queueup.auth.dto.RegisterRequest;
import com.queueup.common.exception.ConflictException;
import com.queueup.common.exception.UnauthorizedException;
import com.queueup.user.AppUser;
import com.queueup.user.AppUserRepository;
import com.queueup.user.UserMapper;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final String INVALID_CREDENTIALS = "Invalid email or password";

  private final AppUserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final RefreshTokenService refreshTokenService;
  private final UserMapper userMapper;
  private final String dummyHash;

  public AuthService(AppUserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
      RefreshTokenService refreshTokenService, UserMapper userMapper) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.refreshTokenService = refreshTokenService;
    this.userMapper = userMapper;
    this.dummyHash = passwordEncoder.encode("timing-equaliser-not-a-real-password-1");
  }

  @Transactional
  public AuthResponse register(RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (userRepository.existsByEmail(email)) {
      throw new ConflictException("An account with this email already exists");
    }
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    user.setFullName(request.fullName().trim());
    user.setPhone(blankToNull(request.phone()));
    userRepository.save(user);
    return tokensFor(user);
  }

  @Transactional
  public AuthResponse login(LoginRequest request) {
    AppUser user = userRepository.findByEmail(normalizeEmail(request.email())).orElse(null);
    if (user == null) {
      passwordEncoder.matches(request.password(), dummyHash);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!passwordEncoder.matches(request.password(), user.getPasswordHash()) || !user.isEnabled()) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return tokensFor(user);
  }

  @Transactional(noRollbackFor = UnauthorizedException.class)
  public AuthResponse refresh(String refreshToken) {
    RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
    AppUser user = userRepository.findById(rotation.userId())
        .filter(AppUser::isEnabled)
        .orElseThrow(() -> new UnauthorizedException("Account is disabled"));
    String accessToken = jwtService.issueAccessToken(user.getId(), user.getEmail());
    return new AuthResponse(accessToken, rotation.refreshToken(), jwtService.accessTokenTtlSeconds(),
        userMapper.toResponse(user));
  }

  @Transactional
  public void logout(String refreshToken) {
    refreshTokenService.revokeFamilyOf(refreshToken);
  }

  private AuthResponse tokensFor(AppUser user) {
    String accessToken = jwtService.issueAccessToken(user.getId(), user.getEmail());
    String refreshToken = refreshTokenService.issue(user.getId());
    return new AuthResponse(accessToken, refreshToken, jwtService.accessTokenTtlSeconds(),
        userMapper.toResponse(user));
  }

  static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
