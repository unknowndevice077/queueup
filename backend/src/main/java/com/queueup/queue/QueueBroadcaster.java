package com.queueup.queue;

import com.queueup.tenant.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Pushes the full public queue state to /topic/tenants/{slug}/queue once a change has committed. */
@Component
public class QueueBroadcaster {

  private static final Logger log = LoggerFactory.getLogger(QueueBroadcaster.class);

  private final QueueService queueService;
  private final TenantRepository tenantRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public QueueBroadcaster(QueueService queueService, TenantRepository tenantRepository,
      SimpMessagingTemplate messagingTemplate) {
    this.queueService = queueService;
    this.tenantRepository = tenantRepository;
    this.messagingTemplate = messagingTemplate;
  }

  public static String topicFor(String tenantSlug) {
    return "/topic/tenants/" + tenantSlug + "/queue";
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onQueueChanged(QueueChangedEvent event) {
    try {
      tenantRepository.findById(event.tenantId()).ifPresent(tenant -> messagingTemplate.convertAndSend(
          topicFor(event.tenantSlug()),
          queueService.publicState(tenant.getId(), tenant.getSlug(), tenant.zoneId())));
    } catch (RuntimeException ex) {
      log.warn("Queue broadcast for {} failed: {}", event.tenantSlug(), ex.getMessage());
    }
  }
}
