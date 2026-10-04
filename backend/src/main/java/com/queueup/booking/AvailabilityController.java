package com.queueup.booking;

import com.queueup.booking.dto.StaffAvailabilityResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Availability")
@RestController
public class AvailabilityController {

  private final BookingService bookingService;

  public AvailabilityController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @Operation(summary = "Open slots per staff member for a service on a tenant-local date")
  @GetMapping("/api/public/tenants/{slug}/availability")
  public List<StaffAvailabilityResponse> availability(@PathVariable String slug, @RequestParam UUID serviceId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) UUID staffId) {
    return bookingService.availability(serviceId, date, staffId);
  }
}
