package com.queueup.config;

import com.queueup.auth.AuthRateLimitFilter;
import com.queueup.auth.AuthRateLimiter;
import com.queueup.auth.JwtAuthenticationFilter;
import com.queueup.auth.JwtService;
import com.queueup.common.web.ProblemResponseWriter;
import com.queueup.tenant.TenantRepository;
import com.queueup.tenant.TenantResolutionFilter;
import com.queueup.user.MembershipRepository;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  private static final String[] PUBLIC_PATHS = {
    "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout",
    "/api/public/**", "/api/webhooks/**", "/ws/**",
    "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**",
    "/actuator/health", "/actuator/health/**", "/error"
  };

  private final AppProperties properties;

  public SecurityConfig(AppProperties properties) {
    this.properties = properties;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
      TenantRepository tenantRepository, MembershipRepository membershipRepository,
      ProblemResponseWriter problemWriter, AuthRateLimiter rateLimiter) throws Exception {
    http
        .csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .headers(headers -> headers
            .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
            .contentSecurityPolicy(csp -> csp.policyDirectives(
                "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                    + "script-src 'self' 'unsafe-inline'; frame-ancestors 'none'")))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            .requestMatchers(PUBLIC_PATHS).permitAll()
            // Admin exports check X-Admin-Token themselves (and answer 404 without it); no user session involved.
            .requestMatchers("/api/admin/**").permitAll()
            .requestMatchers("/actuator/**").denyAll()
            .anyRequest().authenticated())
        .exceptionHandling(errors -> errors
            .authenticationEntryPoint((request, response, ex) -> problemWriter.write(request, response,
                HttpStatus.UNAUTHORIZED, "Unauthorized", "Authentication is required"))
            .accessDeniedHandler((request, response, ex) -> problemWriter.write(request, response,
                HttpStatus.FORBIDDEN, "Forbidden", "You do not have permission to perform this action")))
        .addFilterBefore(new AuthRateLimitFilter(rateLimiter, problemWriter),
            UsernamePasswordAuthenticationFilter.class)
        .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
        .addFilterAfter(new TenantResolutionFilter(tenantRepository, membershipRepository, problemWriter),
            AnonymousAuthenticationFilter.class);
    return http.build();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(properties.security().bcryptStrength());
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(properties.frontendOrigins());
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Trace-Id"));
    cors.setExposedHeaders(List.of("X-Trace-Id", "Content-Disposition", "Retry-After"));
    cors.setAllowCredentials(false);
    cors.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return source;
  }
}
