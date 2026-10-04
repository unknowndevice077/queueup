package com.queueup.schedule;

import com.queueup.auth.AuthUser;
import com.queueup.common.web.PageResponse;
import com.queueup.schedule.dto.BlackoutRequest;
import com.queueup.schedule.dto.BlackoutResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Blackouts")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/t/{slug}/blackouts")
public class BlackoutController {

  private final BlackoutService blackoutService;

  public BlackoutController(BlackoutService blackoutService) {
    this.blackoutService = blackoutService;
  }

  @Operation(summary = "List blackouts (OWNER sees all; STAFF sees their own and business-wide ones)")
  @GetMapping
  public PageResponse<BlackoutResponse> list(@PathVariable String slug,
      @ParameterObject @PageableDefault(size = 50, sort = "startsAt", direction = Sort.Direction.DESC)
      Pageable pageable) {
    return blackoutService.list(pageable);
  }

  @Operation(summary = "Create a blackout (OWNER, or STAFF for themselves)")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BlackoutResponse create(@PathVariable String slug, @Valid @RequestBody BlackoutRequest request,
      @AuthenticationPrincipal AuthUser user) {
    return blackoutService.create(request, user);
  }

  @Operation(summary = "Update a blackout (OWNER, or STAFF for their own)")
  @PutMapping("/{id}")
  public BlackoutResponse update(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody BlackoutRequest request, @AuthenticationPrincipal AuthUser user) {
    return blackoutService.update(id, request, user);
  }

  @Operation(summary = "Delete a blackout (OWNER, or STAFF for their own)")
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String slug, @PathVariable UUID id, @AuthenticationPrincipal AuthUser user) {
    blackoutService.delete(id, user);
  }
}
