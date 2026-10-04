package com.queueup.booking;

import com.queueup.booking.slot.SlotEngine;
import com.queueup.booking.slot.SlotQuery;
import com.queueup.booking.slot.TimeInterval;
import com.queueup.catalog.ServiceOffering;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.catalog.StaffServiceLinkRepository;
import com.queueup.common.exception.NotFoundException;
import com.queueup.config.AppProperties;
import com.queueup.schedule.Blackout;
import com.queueup.schedule.BlackoutRepository;
import com.queueup.schedule.WorkingHours;
import com.queueup.schedule.WorkingHoursRepository;
import com.queueup.tenant.Tenant;
import com.queueup.user.Membership;
import com.queueup.user.MembershipRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads schedule data for a date in a fixed number of queries and runs the {@link SlotEngine} per staff member. */
@Service
public class AvailabilityService {

  private final ServiceOfferingRepository serviceRepository;
  private final StaffServiceLinkRepository linkRepository;
  private final MembershipRepository membershipRepository;
  private final WorkingHoursRepository workingHoursRepository;
  private final BlackoutRepository blackoutRepository;
  private final BookingRepository bookingRepository;
  private final Clock clock;
  private final int stepMinutes;

  public AvailabilityService(ServiceOfferingRepository serviceRepository, StaffServiceLinkRepository linkRepository,
      MembershipRepository membershipRepository, WorkingHoursRepository workingHoursRepository,
      BlackoutRepository blackoutRepository, BookingRepository bookingRepository, Clock clock,
      AppProperties properties) {
    this.serviceRepository = serviceRepository;
    this.linkRepository = linkRepository;
    this.membershipRepository = membershipRepository;
    this.workingHoursRepository = workingHoursRepository;
    this.blackoutRepository = blackoutRepository;
    this.bookingRepository = bookingRepository;
    this.clock = clock;
    this.stepMinutes = properties.booking().slotStepMinutes();
  }

  /** Available starts for one staff member, with their membership. */
  public record StaffSlots(Membership staff, List<ZonedDateTime> slots) {
  }

  @Transactional(readOnly = true)
  public ServiceOffering requireActiveService(UUID tenantId, UUID serviceId) {
    return serviceRepository.findByIdAndTenantId(serviceId, tenantId)
        .filter(ServiceOffering::isActive)
        .orElseThrow(() -> NotFoundException.of("Service"));
  }

  /**
   * Computes availability for a service on a tenant-local date.
   *
   * @param staffId restrict to one staff member, or null for everyone who performs the service
   * @param excludeBookingId a booking to ignore (used when rescheduling it), or null
   */
  @Transactional(readOnly = true)
  public List<StaffSlots> availability(Tenant tenant, ServiceOffering service, LocalDate date, UUID staffId,
      UUID excludeBookingId) {
    ZoneId zone = tenant.zoneId();
    List<UUID> candidateIds = linkRepository.findMembershipIdsByService(tenant.getId(), service.getId()).stream()
        .filter(id -> staffId == null || id.equals(staffId))
        .toList();
    if (candidateIds.isEmpty()) {
      return List.of();
    }
    List<Membership> staff = membershipRepository.findActiveWithUserByIds(tenant.getId(), candidateIds);
    if (staff.isEmpty()) {
      return List.of();
    }
    List<UUID> staffIds = staff.stream().map(Membership::getId).toList();
    Instant dayStart = date.atStartOfDay(zone).toInstant();
    Instant dayEnd = date.plusDays(1).atStartOfDay(zone).toInstant();

    Map<UUID, List<SlotQuery.LocalTimeRange>> hoursByStaff = workingHoursRepository
        .findAllByTenantIdAndMembershipIdInAndDayOfWeek(tenant.getId(), staffIds,
            (short) date.getDayOfWeek().getValue())
        .stream()
        .collect(Collectors.groupingBy(WorkingHours::getMembershipId,
            Collectors.mapping(w -> new SlotQuery.LocalTimeRange(w.getStartTime(), w.getEndTime()),
                Collectors.toList())));
    List<Blackout> blackouts = blackoutRepository.findOverlapping(tenant.getId(), staffIds, dayStart, dayEnd);
    List<Booking> bookings = bookingRepository.findOverlapping(tenant.getId(), staffIds, BookingStatus.BLOCKING,
        dayStart, dayEnd).stream()
        .filter(b -> !b.getId().equals(excludeBookingId))
        .toList();

    Instant earliestStart = clock.instant().plus(Duration.ofMinutes(tenant.getBookingLeadTimeMinutes()));
    List<StaffSlots> result = new ArrayList<>();
    for (Membership member : staff) {
      SlotQuery query = new SlotQuery(date, zone, hoursByStaff.getOrDefault(member.getId(), List.of()),
          busyFor(member.getId(), blackouts, bookings), service.getDurationMinutes(), service.getBufferMinutes(),
          earliestStart, stepMinutes);
      result.add(new StaffSlots(member, SlotEngine.availableStarts(query)));
    }
    return result;
  }

  private static List<TimeInterval> busyFor(UUID staffId, List<Blackout> blackouts, List<Booking> bookings) {
    List<TimeInterval> busy = new ArrayList<>();
    blackouts.stream()
        .filter(b -> b.isBusinessWide() || Objects.equals(b.getMembershipId(), staffId))
        .forEach(b -> busy.add(new TimeInterval(b.getStartsAt(), b.getEndsAt())));
    bookings.stream()
        .filter(b -> b.getStaff().getId().equals(staffId))
        .forEach(b -> busy.add(new TimeInterval(b.getStartsAt(), b.getEndsAt())));
    return busy;
  }
}
