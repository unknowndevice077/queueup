package com.queueup.config;

import java.util.Map;
import java.util.concurrent.Executor;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

  public static final String NOTIFICATION_EXECUTOR = "notificationExecutor";

  @Bean(name = NOTIFICATION_EXECUTOR)
  public Executor notificationExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(4);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("notify-");
    executor.setTaskDecorator(mdcPropagation());
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(10);
    executor.initialize();
    return executor;
  }

  /** Carries the request trace id into async work so logs stay correlated. */
  private static TaskDecorator mdcPropagation() {
    return runnable -> {
      Map<String, String> context = MDC.getCopyOfContextMap();
      return () -> {
        if (context != null) {
          MDC.setContextMap(context);
        }
        try {
          runnable.run();
        } finally {
          MDC.clear();
        }
      };
    };
  }
}
