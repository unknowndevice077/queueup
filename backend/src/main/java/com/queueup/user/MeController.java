package com.queueup.user;

import com.queueup.auth.AuthUser;
import com.queueup.user.dto.MeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Me")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/me")
public class MeController {

  private final MeService meService;

  public MeController(MeService meService) {
    this.meService = meService;
  }

  @Operation(summary = "Current user profile and business memberships")
  @GetMapping
  public MeResponse me(@AuthenticationPrincipal AuthUser user) {
    return meService.me(user.id());
  }
}
