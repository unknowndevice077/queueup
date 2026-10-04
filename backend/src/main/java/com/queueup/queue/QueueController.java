package com.queueup.queue;

import com.queueup.auth.AuthUser;
import com.queueup.queue.dto.JoinQueueRequest;
import com.queueup.queue.dto.PublicQueueState;
import com.queueup.queue.dto.QueueTicketResponse;
import com.queueup.queue.dto.StaffQueueEntry;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Queue")
@RestController
public class QueueController {

  private final QueueService queueService;

  public QueueController(QueueService queueService) {
    this.queueService = queueService;
  }

  @Operation(summary = "Join today's walk-in queue and receive a ticket")
  @PostMapping("/api/public/tenants/{slug}/queue/join")
  @ResponseStatus(HttpStatus.CREATED)
  public QueueTicketResponse join(@PathVariable String slug, @Valid @RequestBody JoinQueueRequest request) {
    return queueService.join(request);
  }

  @Operation(summary = "Public view of today's queue: ticket numbers and statuses only. "
      + "Live updates: STOMP over /ws, topic /topic/tenants/{slug}/queue")
  @GetMapping("/api/public/tenants/{slug}/queue")
  public PublicQueueState publicQueue(@PathVariable String slug) {
    return queueService.publicState();
  }

  @Operation(summary = "Staff console view with contact details (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @GetMapping("/api/t/{slug}/queue")
  public List<StaffQueueEntry> staffQueue(@PathVariable String slug) {
    return queueService.staffView();
  }

  @Operation(summary = "Call the next waiting ticket (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/queue/call-next")
  public StaffQueueEntry callNext(@PathVariable String slug, @AuthenticationPrincipal AuthUser user) {
    return queueService.callNext(user);
  }

  @Operation(summary = "Start serving a ticket (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/queue/{id}/serve")
  public StaffQueueEntry serve(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return queueService.serve(id, user);
  }

  @Operation(summary = "Finish a ticket (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/queue/{id}/done")
  public StaffQueueEntry done(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return queueService.done(id, user);
  }

  @Operation(summary = "Skip a ticket that did not show up (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/queue/{id}/skip")
  public StaffQueueEntry skip(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return queueService.skip(id, user);
  }
}
