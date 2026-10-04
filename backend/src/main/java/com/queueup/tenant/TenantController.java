package com.queueup.tenant;

import com.queueup.auth.AuthUser;
import com.queueup.tenant.dto.CreateTenantRequest;
import com.queueup.tenant.dto.PublicTenantResponse;
import com.queueup.tenant.dto.TenantSettingsResponse;
import com.queueup.tenant.dto.UpdateSettingsRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Businesses")
@RestController
public class TenantController {

  private final TenantService tenantService;

  public TenantController(TenantService tenantService) {
    this.tenantService = tenantService;
  }

  @Operation(summary = "Create a business; the caller becomes its OWNER")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/tenants")
  @ResponseStatus(HttpStatus.CREATED)
  public TenantSettingsResponse create(@Valid @RequestBody CreateTenantRequest request,
      @AuthenticationPrincipal AuthUser user) {
    return tenantService.create(request, user);
  }

  @Operation(summary = "Public business profile with active services and bookable staff")
  @GetMapping("/api/public/tenants/{slug}")
  public PublicTenantResponse publicProfile(@PathVariable String slug) {
    return tenantService.getPublic();
  }

  @Operation(summary = "Business settings (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @GetMapping("/api/t/{slug}/settings")
  public TenantSettingsResponse settings(@PathVariable String slug) {
    return tenantService.getSettings();
  }

  @Operation(summary = "Update business settings (OWNER)")
  @SecurityRequirement(name = "bearerAuth")
  @PatchMapping("/api/t/{slug}/settings")
  public TenantSettingsResponse updateSettings(@PathVariable String slug,
      @Valid @RequestBody UpdateSettingsRequest request, @AuthenticationPrincipal AuthUser user) {
    return tenantService.updateSettings(request, user);
  }
}
