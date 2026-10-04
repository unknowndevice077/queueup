package com.queueup.booking;

import com.queueup.auth.AuthUser;
import com.queueup.booking.dto.BookingResponse;
import com.queueup.booking.dto.CancelBookingRequest;
import com.queueup.booking.dto.CreateBookingRequest;
import com.queueup.booking.dto.RescheduleBookingRequest;
import com.queueup.common.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Bookings")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/t/{slug}/bookings")
public class BookingController {

  private final BookingService bookingService;

  public BookingController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @Operation(summary = "Book a slot as the signed-in customer. 409 if the slot was taken meanwhile.")
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BookingResponse create(@PathVariable String slug, @Valid @RequestBody CreateBookingRequest request,
      @AuthenticationPrincipal AuthUser user) {
    return bookingService.create(request, user);
  }

  @Operation(summary = "Search bookings by tenant-local date range, staff and status (OWNER or STAFF)")
  @GetMapping
  public PageResponse<BookingResponse> search(@PathVariable String slug,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      @RequestParam(required = false) UUID staffId,
      @RequestParam(required = false) BookingStatus status,
      @ParameterObject @PageableDefault(size = 50, sort = "startsAt", direction = Sort.Direction.ASC)
      Pageable pageable) {
    return bookingService.search(from, to, staffId, status, pageable);
  }

  @Operation(summary = "Get one booking (members, or the customer who made it)")
  @GetMapping("/{id}")
  public BookingResponse get(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return bookingService.get(id, user);
  }

  @Operation(summary = "Cancel (customer within the cancellation window, or OWNER/STAFF any time)")
  @PostMapping("/{id}/cancel")
  public BookingResponse cancel(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody(required = false) CancelBookingRequest request, @AuthenticationPrincipal AuthUser user) {
    return bookingService.cancel(id, request == null ? null : request.reason(), user);
  }

  @Operation(summary = "Mark a confirmed booking completed (OWNER or STAFF)")
  @PostMapping("/{id}/complete")
  public BookingResponse complete(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return bookingService.complete(id, user);
  }

  @Operation(summary = "Mark a confirmed booking as no-show after its start time (OWNER or STAFF)")
  @PostMapping("/{id}/no-show")
  public BookingResponse noShow(@PathVariable String slug, @PathVariable UUID id,
      @AuthenticationPrincipal AuthUser user) {
    return bookingService.markNoShow(id, user);
  }

  @Operation(summary = "Move a booking to another slot (same validation as create)")
  @PostMapping("/{id}/reschedule")
  public BookingResponse reschedule(@PathVariable String slug, @PathVariable UUID id,
      @Valid @RequestBody RescheduleBookingRequest request, @AuthenticationPrincipal AuthUser user) {
    return bookingService.reschedule(id, request, user);
  }
}
