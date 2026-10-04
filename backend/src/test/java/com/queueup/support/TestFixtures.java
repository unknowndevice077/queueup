package com.queueup.support;

import com.queueup.auth.JwtService;
import com.queueup.booking.Booking;
import com.queueup.booking.BookingRepository;
import com.queueup.booking.BookingStatus;
import com.queueup.catalog.ServiceOffering;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.catalog.StaffServiceLink;
import com.queueup.catalog.StaffServiceLinkRepository;
import com.queueup.common.tenant.TenantRole;
import com.queueup.schedule.WorkingHours;
import com.queueup.schedule.WorkingHoursRepository;
import com.queueup.tenant.Tenant;
import com.queueup.tenant.TenantRepository;
import com.queueup.user.AppUser;
import com.queueup.user.AppUserRepository;
import com.queueup.user.Membership;
import com.queueup.user.MembershipRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Builds test data directly through repositories so tests only exercise the API they are about. */
@Component
public class TestFixtures {

  public static final String PASSWORD = "Password123";
  public static final ZoneId MANILA = ZoneId.of("Asia/Manila");

  private final AppUserRepository userRepository;
  private final TenantRepository tenantRepository;
  private final MembershipRepository membershipRepository;
  private final ServiceOfferingRepository serviceRepository;
  private final StaffServiceLinkRepository linkRepository;
  private final WorkingHoursRepository workingHoursRepository;
  private final BookingRepository bookingRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public TestFixtures(AppUserRepository userRepository, TenantRepository tenantRepository,
      MembershipRepository membershipRepository, ServiceOfferingRepository serviceRepository,
      StaffServiceLinkRepository linkRepository, WorkingHoursRepository workingHoursRepository,
      BookingRepository bookingRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.userRepository = userRepository;
    this.tenantRepository = tenantRepository;
    this.membershipRepository = membershipRepository;
    this.serviceRepository = serviceRepository;
    this.linkRepository = linkRepository;
    this.workingHoursRepository = workingHoursRepository;
    this.bookingRepository = bookingRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
  }

  public AppUser user(String email) {
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setFullName(email.substring(0, email.indexOf('@')));
    user.setPasswordHash(passwordEncoder.encode(PASSWORD));
    return userRepository.save(user);
  }

  public String token(AppUser user) {
    return jwtService.issueAccessToken(user.getId(), user.getEmail());
  }

  public Tenant tenant(String slug) {
    return tenant(slug, false, 0);
  }

  public Tenant tenant(String slug, boolean depositRequired, int depositPercent) {
    Tenant tenant = new Tenant();
    tenant.setName("Business " + slug);
    tenant.setSlug(slug);
    tenant.setDepositRequired(depositRequired);
    tenant.setDepositPercent(depositPercent);
    return tenantRepository.save(tenant);
  }

  public Membership member(Tenant tenant, AppUser user, TenantRole role) {
    Membership membership = new Membership();
    membership.setTenantId(tenant.getId());
    membership.setUser(user);
    membership.setRole(role);
    return membershipRepository.save(membership);
  }

  public ServiceOffering service(Tenant tenant, String name, int minutes, int buffer, long priceCentavos) {
    ServiceOffering service = new ServiceOffering();
    service.setTenantId(tenant.getId());
    service.setName(name);
    service.setDurationMinutes(minutes);
    service.setBufferMinutes(buffer);
    service.setPriceCentavos(priceCentavos);
    return serviceRepository.save(service);
  }

  public void canPerform(Tenant tenant, Membership staff, ServiceOffering service) {
    StaffServiceLink link = new StaffServiceLink();
    link.setTenantId(tenant.getId());
    link.setMembershipId(staff.getId());
    link.setServiceId(service.getId());
    linkRepository.save(link);
  }

  /** Works 09:00-17:00 every day of the week. */
  public void worksEveryDay(Tenant tenant, Membership staff) {
    for (short day = 1; day <= 7; day++) {
      WorkingHours hours = new WorkingHours();
      hours.setTenantId(tenant.getId());
      hours.setMembershipId(staff.getId());
      hours.setDayOfWeek(day);
      hours.setStartTime(LocalTime.of(9, 0));
      hours.setEndTime(LocalTime.of(17, 0));
      workingHoursRepository.save(hours);
    }
  }

  /** ISO-8601 with offset and seconds, exactly as the API serialises times. */
  public static String iso(ZonedDateTime time) {
    return time.toOffsetDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
  }

  /** A bookable start, a few days ahead so lead time and cancellation windows never interfere. */
  public static ZonedDateTime futureSlot(int daysAhead, int hour) {
    return LocalDate.now(MANILA).plusDays(daysAhead).atTime(hour, 0).atZone(MANILA);
  }

  public Booking booking(Tenant tenant, AppUser customer, Membership staff, ServiceOffering service, Instant start,
      BookingStatus status) {
    Booking booking = new Booking();
    booking.setTenantId(tenant.getId());
    booking.setCustomer(customer);
    booking.setStaff(staff);
    booking.setService(service);
    booking.setStartsAt(start);
    booking.setEndsAt(start.plus(Duration.ofMinutes(service.blockMinutes())));
    booking.setStatus(status);
    booking.setPriceCentavos(service.getPriceCentavos());
    return bookingRepository.save(booking);
  }

  /** A ready-to-book business: owner who also serves, one 30-minute service, open 09:00-17:00 daily. */
  public Shop shop(String slug) {
    return shop(slug, false, 0);
  }

  public Shop shop(String slug, boolean depositRequired, int depositPercent) {
    Tenant tenant = tenant(slug, depositRequired, depositPercent);
    AppUser owner = user("owner@" + slug + ".test");
    Membership ownerMembership = member(tenant, owner, TenantRole.OWNER);
    ServiceOffering service = service(tenant, "Haircut", 30, 0, 25_000);
    canPerform(tenant, ownerMembership, service);
    worksEveryDay(tenant, ownerMembership);
    return new Shop(tenant, owner, ownerMembership, service, token(owner));
  }

  /** A seeded business and its owner. */
  public record Shop(Tenant tenant, AppUser owner, Membership ownerMembership, ServiceOffering service,
      String ownerToken) {

    public String slug() {
      return tenant.getSlug();
    }
  }
}
