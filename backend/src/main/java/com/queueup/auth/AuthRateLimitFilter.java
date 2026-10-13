package com.queueup.auth;

import com.queueup.common.web.ProblemResponseWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.OptionalLong;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

/** Applies {@link AuthRateLimiter} to the credential endpoints and answers 429 when exceeded. */
public class AuthRateLimitFilter extends OncePerRequestFilter {

  private static final Set<String> LIMITED_PATHS = Set.of(
      "/api/auth/login", "/api/auth/register", "/api/public/waitlist");

  private final AuthRateLimiter rateLimiter;
  private final ProblemResponseWriter problemWriter;

  public AuthRateLimitFilter(AuthRateLimiter rateLimiter, ProblemResponseWriter problemWriter) {
    this.rateLimiter = rateLimiter;
    this.problemWriter = problemWriter;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !"POST".equals(request.getMethod()) || !LIMITED_PATHS.contains(request.getRequestURI());
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    OptionalLong retryAfter = rateLimiter.tryConsume(request.getRemoteAddr() + "|" + request.getRequestURI());
    if (retryAfter.isEmpty()) {
      chain.doFilter(request, response);
      return;
    }
    response.setHeader("Retry-After", String.valueOf(retryAfter.getAsLong()));
    problemWriter.write(request, response, HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests",
        "Too many attempts. Try again in " + retryAfter.getAsLong() + " seconds.");
  }
}
