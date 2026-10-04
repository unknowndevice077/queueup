package com.queueup.user;

import com.queueup.auth.AuthUser;
import com.queueup.user.dto.InviteStaffRequest;
import com.queueup.user.dto.StaffResponse;
import com.queueup.user.dto.StaffServicesRequest;
import com.queueup.user.dto.UpdateStaffRequest;
import com.queueup.user.dto.WorkingHoursRequest;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Staff")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/t/{slug}/staff")
public class StaffController {

  private final StaffService staffService;

  public StaffController(StaffService staffService) {
    this.staffService = staffService;
  }

  @Operation(summary = "List members with their services and weekly schedule (OWNER or STAFF)")
  @GetMapping
  public List<StaffResponse> list(@PathVariable String slug) {
    return staffService.list();
  }

  @Operation(summary = "Get one member (OWNER or STAFF)")
  @GetMapping("/{id}")
  public StaffResponse get(@PathVariable String slug, @PathVariable UUID id) {
    return staffService.get(id);
  }

  @Operation(summary = "Add an existing user to the business as STAFF (OWNER)")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public StaffResponse invite(@PathVariable String slug, @Valid @RequestBody InviteStaffRequest request,
      @AuthenticationPrincipal AuthUser user) {
    return staffService.invite(request.email(), user);
  }

  @Operation(summary = "Change role or active flag (OWNER)")
  @PatchMapping("/{id}")
  public StaffResponse update(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody UpdateStaffRequest request, @AuthenticationPrincipal AuthUser user) {
    return staffService.update(id, request, user);
  }

  @Operation(summary = "Remove (deactivate) a member (OWNER)")
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable String slug, @PathVariable UUID id, @AuthenticationPrincipal AuthUser user) {
    staffService.remove(id, user);
  }

  @Operation(summary = "Replace the services this member can perform (OWNER)")
  @PutMapping("/{id}/services")
  public StaffResponse assignServices(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody StaffServicesRequest request, @AuthenticationPrincipal AuthUser user) {
    return staffService.assignServices(id, request.serviceIds(), user);
  }

  @Operation(summary = "Replace the full weekly schedule (OWNER). Multiple ranges per day model breaks.")
  @PutMapping("/{id}/working-hours")
  public StaffResponse replaceWorkingHours(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody WorkingHoursRequest request, @AuthenticationPrincipal AuthUser user) {
    return staffService.replaceWorkingHours(id, request.ranges(), user);
  }
}
