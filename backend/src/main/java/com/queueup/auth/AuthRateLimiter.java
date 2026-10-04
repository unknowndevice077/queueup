package com.queueup.auth;

import com.queueup.config.AppProperties;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import java.time.Duration;
import java.util.Map;
import java.util.OptionalLong;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** In-memory token buckets keyed by client IP and endpoint (Bucket4j). */
@Component
public class AuthRateLimiter {

  private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
  private final int requestsPerMinute;

  public AuthRateLimiter(AppProperties properties) {
    this.requestsPerMinute = properties.security().authRateLimitPerMinute();
  }

  /** Consumes one token. Returns empty when allowed, or the seconds to wait when the limit is exceeded. */
  public OptionalLong tryConsume(String key) {
    ConsumptionProbe probe = buckets.computeIfAbsent(key, k -> newBucket()).tryConsumeAndReturnRemaining(1);
    if (probe.isConsumed()) {
      return OptionalLong.empty();
    }
    return OptionalLong.of(Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill())));
  }

  /** Drops fully refilled buckets so memory stays bounded by the number of recently active clients. */
  @Scheduled(fixedDelay = 600_000)
  public void evictIdleBuckets() {
    buckets.entrySet().removeIf(entry -> entry.getValue().getAvailableTokens() >= requestsPerMinute);
  }

  public void reset() {
    buckets.clear();
  }

  private Bucket newBucket() {
    return Bucket.builder()
        .addLimit(Bandwidth.builder()
            .capacity(requestsPerMinute)
            .refillIntervally(requestsPerMinute, Duration.ofMinutes(1))
            .build())
        .build();
  }
}
