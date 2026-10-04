package com.queueup.seed;

import com.queueup.catalog.ServiceOffering;
import com.queueup.catalog.ServiceOfferingRepository;
import com.queueup.catalog.StaffServiceLink;
import com.queueup.catalog.StaffServiceLinkRepository;
import com.queueup.common.tenant.TenantRole;
import com.queueup.schedule.Blackout;
import com.queueup.schedule.BlackoutRepository;
import com.queueup.schedule.WorkingHours;
import com.queueup.schedule.WorkingHoursRepository;
import com.queueup.tenant.Tenant;
import com.queueup.tenant.TenantRepository;
import com.queueup.user.AppUser;
import com.queueup.user.AppUserRepository;
import com.queueup.user.Membership;
import com.queueup.user.MembershipRepository;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates two demo businesses, demo accounts and realistic history so the dashboard has something to show.
 * Runs only when SEED_DEMO=true and only once (it skips if the demo tenant already exists).
 */
@Component
@ConditionalOnProperty(name = "queueup.seed-demo", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

  public static final String DEMO_PASSWORD = "Demo12345!";
  private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
  private static final int HISTORY_DAYS = 60;
  private static final int UPCOMING_DAYS = 7;
  private static final String[] CUSTOMER_NAMES = {
    "Ana Reyes", "Miguel Santos", "Carla Mendoza", "Paolo Garcia", "Bianca Torres", "Joshua Ramos",
    "Patricia Cruz", "Kevin Bautista", "Andrea Flores", "Christian Navarro", "Nicole Aquino", "Mark Castillo",
    "Sofia Villanueva", "Gabriel Lim", "Isabel Fernandez"
  };

  private final TenantRepository tenantRepository;
  private final AppUserRepository userRepository;
  private final MembershipRepository membershipRepository;
  private final ServiceOfferingRepository serviceRepository;
  private final StaffServiceLinkRepository linkRepository;
  private final WorkingHoursRepository workingHoursRepository;
  private final BlackoutRepository blackoutRepository;
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwordEncoder;
  private final Clock clock;
  private final Random random = new Random(20_261_005L);
  private String passwordHash;

  public DemoDataSeeder(TenantRepository tenantRepository, AppUserRepository userRepository,
      MembershipRepository membershipRepository, ServiceOfferingRepository serviceRepository,
      StaffServiceLinkRepository linkRepository, WorkingHoursRepository workingHoursRepository,
      BlackoutRepository blackoutRepository, JdbcTemplate jdbc, PasswordEncoder passwordEncoder, Clock clock) {
    this.tenantRepository = tenantRepository;
    this.userRepository = userRepository;
    this.membershipRepository = membershipRepository;
    this.serviceRepository = serviceRepository;
    this.linkRepository = linkRepository;
    this.workingHoursRepository = workingHoursRepository;
    this.blackoutRepository = blackoutRepository;
    this.jdbc = jdbc;
    this.passwordEncoder = passwordEncoder;
    this.clock = clock;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (tenantRepository.existsBySlug("kanto-cuts")) {
      log.info("Demo data already present; skipping seed");
      return;
    }
    passwordHash = passwordEncoder.encode(DEMO_PASSWORD);
    AppUser owner = user("owner@demo.queueup", "Rafael \"Paeng\" Santos", "+63 917 555 0101");
    AppUser staff = user("staff@demo.queueup", "Mark Villanueva", "+63 917 555 0102");
    AppUser customer = user("customer@demo.queueup", "Ana Reyes", "+63 917 555 0103");
    AppUser barberJun = user("jun@demo.queueup", "Jun Dela Cruz", "+63 917 555 0104");
    AppUser dentist = user("dra.lim@demo.queueup", "Dra. Bea Lim", "+63 917 555 0201");
    List<AppUser> customers = new ArrayList<>();
    customers.add(customer);
    for (int i = 1; i < CUSTOMER_NAMES.length; i++) {
      String email = CUSTOMER_NAMES[i].toLowerCase().replace(' ', '.') + "@example.ph";
      customers.add(user(email, CUSTOMER_NAMES[i], "+63 918 555 " + String.format("%04d", 1000 + i)));
    }

    seedKantoCuts(owner, staff, barberJun, customers);
    seedSanareDental(owner, dentist, customers);
    log.info("Seeded demo data: kanto-cuts and sanare-dental (password for demo accounts: see README)");
  }

  private void seedKantoCuts(AppUser owner, AppUser staff, AppUser jun, List<AppUser> customers) {
    Tenant tenant = tenant("Kanto Cuts Barbershop", "kanto-cuts", 30, 2, false, 0);
    tenant.setContactEmail("hello@kantocuts.ph");
    tenant.setContactPhone("+63 2 8555 0100");
    tenant.setAddress("123 Kalayaan Ave, Diliman, Quezon City");

    Membership paeng = membership(tenant, owner, TenantRole.OWNER);
    Membership mark = membership(tenant, staff, TenantRole.STAFF);
    Membership junMember = membership(tenant, jun, TenantRole.STAFF);

    ServiceOffering haircut = service(tenant, "Classic Haircut", "Cut, wash and style.", 30, 5, 25_000);
    ServiceOffering haircutShave = service(tenant, "Haircut + Hot Towel Shave",
        "Our signature cut with a straight-razor hot towel shave.", 45, 5, 40_000);
    ServiceOffering beard = service(tenant, "Beard Trim", "Shape-up and line-up for beards.", 20, 0, 15_000);
    ServiceOffering color = service(tenant, "Hair Color", "Full color with premium dye.", 90, 10, 120_000);

    link(tenant, paeng, haircut, haircutShave, beard, color);
    link(tenant, mark, haircut, haircutShave, beard);
    link(tenant, junMember, haircut, beard, color);

    List<DayOfWeek> monToSat = List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);
    hours(tenant, paeng, monToSat, LocalTime.of(9, 0), LocalTime.of(12, 0), LocalTime.of(13, 0), LocalTime.of(19, 0));
    hours(tenant, mark, monToSat, LocalTime.of(10, 0), LocalTime.of(13, 0), LocalTime.of(14, 0), LocalTime.of(20, 0));
    hours(tenant, junMember, List.of(DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY),
        LocalTime.of(9, 0), LocalTime.of(12, 0), LocalTime.of(13, 0), LocalTime.of(18, 0));

    ZoneId zone = tenant.zoneId();
    LocalDate today = LocalDate.now(clock.withZone(zone));
    Blackout fiesta = new Blackout();
    fiesta.setTenantId(tenant.getId());
    fiesta.setStartsAt(today.plusDays(10).atTime(13, 0).atZone(zone).toInstant());
    fiesta.setEndsAt(today.plusDays(10).atTime(20, 0).atZone(zone).toInstant());
    fiesta.setReason("Barangay fiesta - closing early");
    blackoutRepository.save(fiesta);

    List<StaffPlan> plans = List.of(
        new StaffPlan(paeng, List.of(haircut, haircutShave, beard, color), weekly(monToSat, 9, 12, 13, 19)),
        new StaffPlan(mark, List.of(haircut, haircutShave, beard), weekly(monToSat, 10, 13, 14, 20)),
        new StaffPlan(junMember, List.of(haircut, beard, color), weekly(List.of(DayOfWeek.TUESDAY,
            DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY),
            9, 12, 13, 18)));
    seedBookings(tenant, plans, customers, 0.55, 0);
    seedQueue(tenant, List.of(haircut, beard, haircutShave), today);
  }

  private void seedSanareDental(AppUser owner, AppUser dentist, List<AppUser> customers) {
    Tenant tenant = tenant("Sanare Dental Clinic", "sanare-dental", 120, 24, true, 20);
    tenant.setContactEmail("appointments@sanaredental.ph");
    tenant.setContactPhone("+63 32 555 0200");
    tenant.setAddress("2F Ayala Center Annex, Cebu Business Park, Cebu City");

    Membership ownerMember = membership(tenant, owner, TenantRole.OWNER);
    Membership bea = membership(tenant, dentist, TenantRole.STAFF);
    ServiceOffering consult = service(tenant, "Consultation", "Check-up and treatment plan.", 30, 10, 80_000);
    ServiceOffering cleaning = service(tenant, "Dental Cleaning", "Oral prophylaxis.", 45, 15, 150_000);
    ServiceOffering extraction = service(tenant, "Tooth Extraction", "Simple extraction.", 60, 15, 250_000);
    ServiceOffering whitening = service(tenant, "Teeth Whitening", "In-clinic whitening session.", 90, 15,
        800_000);
    link(tenant, bea, consult, cleaning, extraction, whitening);
    link(tenant, ownerMember, consult);

    List<DayOfWeek> weekdays = List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);
    hours(tenant, bea, weekdays, LocalTime.of(9, 0), LocalTime.of(12, 0), LocalTime.of(13, 0), LocalTime.of(17, 0));
    hours(tenant, bea, List.of(DayOfWeek.SATURDAY), LocalTime.of(9, 0), LocalTime.of(12, 0), null, null);
    hours(tenant, ownerMember, List.of(DayOfWeek.SATURDAY), LocalTime.of(9, 0), LocalTime.of(12, 0), null, null);

    List<StaffPlan> plans = List.of(new StaffPlan(bea, List.of(consult, cleaning, extraction, whitening),
        weekly(weekdays, 9, 12, 13, 17)));
    seedBookings(tenant, plans, customers, 0.45, 20);
  }

  /** Fills past days with finished bookings and the next week with confirmed ones, never overlapping per staff. */
  private void seedBookings(Tenant tenant, List<StaffPlan> plans, List<AppUser> customers, double fillRate,
      int depositPercent) {
    ZoneId zone = tenant.zoneId();
    Instant now = clock.instant();
    LocalDate today = LocalDate.now(clock.withZone(zone));
    List<Object[]> rows = new ArrayList<>();
    for (LocalDate day = today.minusDays(HISTORY_DAYS); !day.isAfter(today.plusDays(UPCOMING_DAYS));
        day = day.plusDays(1)) {
      for (StaffPlan plan : plans) {
        for (LocalTime[] range : plan.rangesFor(day.getDayOfWeek())) {
          Instant cursor = day.atTime(range[0]).atZone(zone).toInstant();
          Instant rangeEnd = day.atTime(range[1]).atZone(zone).toInstant();
          while (cursor.isBefore(rangeEnd)) {
            ServiceOffering service = plan.services().get(random.nextInt(plan.services().size()));
            Instant end = cursor.plus(Duration.ofMinutes(service.blockMinutes()));
            boolean upcoming = cursor.isAfter(now);
            double rate = upcoming ? fillRate * 0.5 : fillRate;
            if (end.isAfter(rangeEnd) || random.nextDouble() > rate) {
              cursor = cursor.plus(Duration.ofMinutes(30));
              continue;
            }
            AppUser customer = upcoming && random.nextDouble() < 0.12 ? customers.getFirst()
                : customers.get(1 + random.nextInt(customers.size() - 1));
            String status = upcoming ? "CONFIRMED" : pastStatus();
            long deposit = service.getPriceCentavos() * depositPercent / 100;
            Instant createdAt = cursor.minus(Duration.ofHours(2 + random.nextInt(24 * 7)));
            rows.add(new Object[] {UUID.randomUUID(), tenant.getId(), customer.getId(), plan.staff().getId(),
                service.getId(), Timestamp.from(cursor), Timestamp.from(end), status, service.getPriceCentavos(),
                deposit, "CANCELLED".equals(status) ? "Customer cancelled" : null,
                Timestamp.from(createdAt.isAfter(now) ? now : createdAt)});
            cursor = end.plus(Duration.ofMinutes(random.nextInt(3) * 15L));
          }
        }
      }
    }
    jdbc.batchUpdate("""
        INSERT INTO booking (id, tenant_id, customer_id, staff_membership_id, service_id, starts_at, ends_at,
                             status, price_centavos, deposit_centavos, cancelled_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
        """, rows);
    log.info("Seeded {} bookings for {}", rows.size(), tenant.getSlug());
  }

  private String pastStatus() {
    double roll = random.nextDouble();
    if (roll < 0.78) {
      return "COMPLETED";
    }
    return roll < 0.86 ? "NO_SHOW" : "CANCELLED";
  }

  private void seedQueue(Tenant tenant, List<ServiceOffering> services, LocalDate today) {
    Instant now = clock.instant();
    String[][] walkIns = {
      {"Ramon", "DONE"}, {"Leo", "DONE"}, {"Carlo", "SERVING"}, {"Dennis", "CALLED"},
      {"Jerome", "WAITING"}, {"Arvin", "WAITING"}, {"Bong", "WAITING"}
    };
    List<Object[]> rows = new ArrayList<>();
    for (int i = 0; i < walkIns.length; i++) {
      String status = walkIns[i][1];
      Instant joined = now.minus(Duration.ofMinutes((long) (walkIns.length - i) * 12));
      Instant called = "WAITING".equals(status) ? null : joined.plus(Duration.ofMinutes(10));
      Instant finished = "DONE".equals(status) ? joined.plus(Duration.ofMinutes(35)) : null;
      rows.add(new Object[] {UUID.randomUUID(), tenant.getId(), today, i + 1, walkIns[i][0],
          "+63 919 555 " + String.format("%04d", 2000 + i), services.get(i % services.size()).getId(), status,
          Timestamp.from(joined), called == null ? null : Timestamp.from(called),
          finished == null ? null : Timestamp.from(finished)});
    }
    jdbc.batchUpdate("""
        INSERT INTO queue_entry (id, tenant_id, queue_date, ticket_number, customer_name, customer_phone, service_id,
                                 status, joined_at, called_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows);
    jdbc.update("INSERT INTO queue_counter (tenant_id, queue_date, last_number) VALUES (?, ?, ?)",
        tenant.getId(), today, walkIns.length);
  }

  private AppUser user(String email, String fullName, String phone) {
    AppUser user = new AppUser();
    user.setEmail(email);
    user.setFullName(fullName);
    user.setPhone(phone);
    user.setPasswordHash(passwordHash);
    user.setEmailVerified(true);
    return userRepository.save(user);
  }

  private Tenant tenant(String name, String slug, int leadMinutes, int cancelHours, boolean deposit, int percent) {
    Tenant tenant = new Tenant();
    tenant.setName(name);
    tenant.setSlug(slug);
    tenant.setBookingLeadTimeMinutes(leadMinutes);
    tenant.setCancellationWindowHours(cancelHours);
    tenant.setDepositRequired(deposit);
    tenant.setDepositPercent(percent);
    return tenantRepository.saveAndFlush(tenant);
  }

  private Membership membership(Tenant tenant, AppUser user, TenantRole role) {
    Membership membership = new Membership();
    membership.setTenantId(tenant.getId());
    membership.setUser(user);
    membership.setRole(role);
    return membershipRepository.saveAndFlush(membership);
  }

  private ServiceOffering service(Tenant tenant, String name, String description, int minutes, int buffer,
      long priceCentavos) {
    ServiceOffering service = new ServiceOffering();
    service.setTenantId(tenant.getId());
    service.setName(name);
    service.setDescription(description);
    service.setDurationMinutes(minutes);
    service.setBufferMinutes(buffer);
    service.setPriceCentavos(priceCentavos);
    return serviceRepository.saveAndFlush(service);
  }

  private void link(Tenant tenant, Membership member, ServiceOffering... services) {
    for (ServiceOffering service : services) {
      StaffServiceLink link = new StaffServiceLink();
      link.setTenantId(tenant.getId());
      link.setMembershipId(member.getId());
      link.setServiceId(service.getId());
      linkRepository.save(link);
    }
  }

  private void hours(Tenant tenant, Membership member, List<DayOfWeek> days, LocalTime morningStart,
      LocalTime morningEnd, LocalTime afternoonStart, LocalTime afternoonEnd) {
    for (DayOfWeek day : days) {
      workingHoursRepository.save(range(tenant, member, day, morningStart, morningEnd));
      if (afternoonStart != null) {
        workingHoursRepository.save(range(tenant, member, day, afternoonStart, afternoonEnd));
      }
    }
    workingHoursRepository.flush();
  }

  private static WorkingHours range(Tenant tenant, Membership member, DayOfWeek day, LocalTime start,
      LocalTime end) {
    WorkingHours hours = new WorkingHours();
    hours.setTenantId(tenant.getId());
    hours.setMembershipId(member.getId());
    hours.setDayOfWeek((short) day.getValue());
    hours.setStartTime(start);
    hours.setEndTime(end);
    return hours;
  }

  private static List<WeeklyRange> weekly(List<DayOfWeek> days, int morningStart, int morningEnd,
      int afternoonStart, int afternoonEnd) {
    return days.stream().map(day -> new WeeklyRange(day, new LocalTime[][] {
      {LocalTime.of(morningStart, 0), LocalTime.of(morningEnd, 0)},
      {LocalTime.of(afternoonStart, 0), LocalTime.of(afternoonEnd, 0)}
    })).toList();
  }

  private record WeeklyRange(DayOfWeek day, LocalTime[][] ranges) {
  }

  private record StaffPlan(Membership staff, List<ServiceOffering> services, List<WeeklyRange> week) {

    List<LocalTime[]> rangesFor(DayOfWeek day) {
      return week.stream().filter(w -> w.day() == day).flatMap(w -> List.of(w.ranges()).stream()).toList();
    }
  }
}
