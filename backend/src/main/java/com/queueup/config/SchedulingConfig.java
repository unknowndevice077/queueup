package com.queueup.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Scheduled jobs are switchable so integration tests can trigger them deterministically. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "queueup.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
