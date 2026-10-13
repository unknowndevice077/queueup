package com.queueup.waitlist;

import com.queueup.common.exception.NotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Waitlist")
@RestController
public class WaitlistController {

  private final WaitlistService waitlistService;
  private final String adminToken;

  public WaitlistController(WaitlistService waitlistService,
      @Value("${queueup.admin-token:}") String adminToken) {
    this.waitlistService = waitlistService;
    this.adminToken = adminToken;
  }

  @Operation(summary = "Join the early-access waitlist; returns your place in line")
  @PostMapping("/api/public/waitlist")
  @ResponseStatus(HttpStatus.CREATED)
  public WaitlistService.Position join(@Valid @RequestBody WaitlistRequest request) {
    return waitlistService.join(request);
  }

  /**
   * CSV of every signup for follow-up. Guarded by the ADMIN_TOKEN environment variable; when it is unset, or the
   * header does not match, the endpoint answers 404 so its existence is not advertised.
   */
  @Operation(summary = "Export the waitlist as CSV (requires X-Admin-Token)")
  @GetMapping(value = "/api/admin/waitlist.csv", produces = "text/csv")
  public ResponseEntity<String> export(@RequestHeader(value = "X-Admin-Token", required = false) String token) {
    if (adminToken.isBlank() || token == null || !MessageDigest.isEqual(
        adminToken.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8))) {
      throw new NotFoundException("Not found");
    }
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"queueup-waitlist.csv\"")
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(waitlistService.exportCsv());
  }
}
