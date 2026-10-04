package com.queueup.catalog;

import com.queueup.auth.AuthUser;
import com.queueup.catalog.dto.ServiceRequest;
import com.queueup.catalog.dto.ServiceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Services")
@RestController
public class ServiceController {

  private final ServiceOfferingService serviceOfferingService;

  public ServiceController(ServiceOfferingService serviceOfferingService) {
    this.serviceOfferingService = serviceOfferingService;
  }

  @Operation(summary = "Active services of a business (public)")
  @GetMapping("/api/public/tenants/{slug}/services")
  public List<ServiceResponse> listPublic(@PathVariable String slug) {
    return serviceOfferingService.listActivePublic();
  }

  @Operation(summary = "All services including inactive ones (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @GetMapping("/api/t/{slug}/services")
  public List<ServiceResponse> list(@PathVariable String slug) {
    return serviceOfferingService.listAll();
  }

  @Operation(summary = "Get one service (OWNER or STAFF)")
  @SecurityRequirement(name = "bearerAuth")
  @GetMapping("/api/t/{slug}/services/{id}")
  public ServiceResponse get(@PathVariable String slug, @PathVariable UUID id) {
    return serviceOfferingService.get(id);
  }

  @Operation(summary = "Create a service (OWNER)")
  @SecurityRequirement(name = "bearerAuth")
  @PostMapping("/api/t/{slug}/services")
  @ResponseStatus(HttpStatus.CREATED)
  public ServiceResponse create(@PathVariable String slug, @Valid @RequestBody ServiceRequest request,
      @AuthenticationPrincipal AuthUser user) {
    return serviceOfferingService.create(request, user);
  }

  @Operation(summary = "Replace a service (OWNER)")
  @SecurityRequirement(name = "bearerAuth")
  @PutMapping("/api/t/{slug}/services/{id}")
  public ServiceResponse update(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody ServiceRequest request, @AuthenticationPrincipal AuthUser user) {
    return serviceOfferingService.update(id, request, user);
  }

  @Operation(summary = "Deactivate a service (OWNER). Bookings keep referencing it.")
  @SecurityRequirement(name = "bearerAuth")
  @DeleteMapping("/api/t/{slug}/services/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String slug, @PathVariable UUID id, @AuthenticationPrincipal AuthUser user) {
    serviceOfferingService.deactivate(id, user);
  }
}
