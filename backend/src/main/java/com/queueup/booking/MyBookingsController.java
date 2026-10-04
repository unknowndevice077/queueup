package com.queueup.booking;

import com.queueup.auth.AuthUser;
import com.queueup.booking.dto.BookingResponse;
import com.queueup.common.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Me")
@SecurityRequirement(name = "bearerAuth")
@RestController
public class MyBookingsController {

  private final BookingService bookingService;

  public MyBookingsController(BookingService bookingService) {
    this.bookingService = bookingService;
  }

  @Operation(summary = "The signed-in customer's bookings across all businesses")
  @GetMapping("/api/me/bookings")
  public PageResponse<BookingResponse> myBookings(@AuthenticationPrincipal AuthUser user,
      @ParameterObject @PageableDefault(size = 50, sort = "startsAt", direction = Sort.Direction.DESC)
      Pageable pageable) {
    return bookingService.myBookings(user, pageable);
  }
}
