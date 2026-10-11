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
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Random;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates two demo businesses, demo accounts and realistic history so the dashboard has something to show.
 * Runs only when SEED_DEMO=true. The businesses are created once; after that an hourly refresh keeps the demo
 * looking like a working shop: past confirmed bookings are closed out, missing days are filled with bookings, and
 * today's walk-in line is started if nobody has joined yet.
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
      log.info("Demo data already present; refreshing it");
    } else {
      seedBusinesses();
    }
    refresh();
  }

  private void seedBusinesses() {
    passwordHash = passwordEncoder.encode(DEMO_PASSWORD);
    AppUser owner = user("owner@demo.queueup", "Rafael \"Paeng\" Santos", "+63 917 555 0101");
    AppUser staff = user("staff@demo.queueup", "Mark Villanueva", "+63 917 555 0102");
    user("customer@demo.queueup", "Ana Reyes", "+63 917 555 0103");
    AppUser barberJun = user("jun@demo.queueup", "Jun Dela Cruz", "+63 917 555 0104");
    AppUser dentist = user("dra.lim@demo.queueup", "Dra. Bea Lim", "+63 917 555 0201");
    for (int i = 1; i < CUSTOMER_NAMES.length; i++) {
      String email = CUSTOMER_NAMES[i].toLowerCase().replace(' ', '.') + "@example.ph";
      user(email, CUSTOMER_NAMES[i], "+63 918 555 " + String.format("%04d", 1000 + i));
    }

    seedKantoCuts(owner, staff, barberJun);
    seedSanareDental(owner, dentist);
    log.info("Seeded demo data: kanto-cuts and sanare-dental (password for demo accounts: see README)");
  }

  /** Keeps the demo current. Idempotent: every step only fills what is missing. */
  @Scheduled(cron = "0 7 * * * *")
  @Transactional
  public void refresh() {
    List<UUID> customers = jdbc.queryForList("""
        SELECT id FROM app_user WHERE email = 'customer@demo.queueup' OR email LIKE '%@example.ph'
        ORDER BY (email = 'customer@demo.queueup') DESC, email
        """, UUID.class);
    if (customers.size() < 2) {
      return;
    }
    refreshTenant("kanto-cuts", 0.55, 0, customers, true);
    refreshTenant("sanare-dental", 0.45, 20, customers, false);
  }

  private void refreshTenant(String slug, double fillRate, int depositPercent, List<UUID> customers,
      boolean walkIns) {
    Tenant tenant = tenantRepository.findBySlug(slug).orElse(null);
    if (tenant == null) {
      return;
    }
    ZoneId zone = tenant.zoneId();
    Instant now = clock.instant();
    LocalDate today = LocalDate.now(clock.withZone(zone));

    int closed = jdbc.update("""
        UPDATE booking SET status = CASE WHEN random() < 0.9 THEN 'COMPLETED' ELSE 'NO_SHOW' END, updated_at = now()
        WHERE tenant_id = ? AND status = 'CONFIRMED' AND ends_at < ?
        """, tenant.getId(), Timestamp.from(now));

    Set<LocalDate> seededDays = new HashSet<>(jdbc.queryForList("""
        SELECT DISTINCT (b.starts_at AT TIME ZONE ?)::date FROM booking b
        JOIN app_user u ON u.id = b.customer_id
        WHERE b.tenant_id = ? AND (u.email = 'customer@demo.queueup' OR u.email LIKE '%@example.ph')
        """, LocalDate.class, zone.getId(), tenant.getId()));
    List<StaffPlan> plans = plansFor(tenant);
    List<Object[]> rows = new ArrayList<>();
    for (LocalDate day = today.minusDays(HISTORY_DAYS); !day.isAfter(today.plusDays(UPCOMING_DAYS));
        day = day.plusDays(1)) {
      if (!seededDays.contains(day)) {
        rows.addAll(bookingsFor(tenant, day, plans, customers, fillRate, depositPercent, now));
      }
    }
    if (!rows.isEmpty()) {
      jdbc.batchUpdate("""
          INSERT INTO booking (id, tenant_id, customer_id, staff_membership_id, service_id, starts_at, ends_at,
                               status, price_centavos, deposit_centavos, cancelled_reason, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
          ON CONFLICT DO NOTHING
          """, rows);
    }

    boolean queueStarted = Boolean.TRUE.equals(jdbc.queryForObject(
        "SELECT EXISTS (SELECT 1 FROM queue_counter WHERE tenant_id = ? AND queue_date = ?)", Boolean.class,
        tenant.getId(), today));
    if (walkIns && !queueStarted) {
      seedQueue(tenant, today);
    }
    if (closed > 0 || !rows.isEmpty()) {
      log.info("Refreshed demo {}: closed {} past bookings, added {}", slug, closed, rows.size());
    }
  }

  private void seedKantoCuts(AppUser owner, AppUser staff, AppUser jun) {
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
  }

  private void seedSanareDental(AppUser owner, AppUser dentist) {
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
  }

  /** One day of bookings: finished ones before now, confirmed ones after, never overlapping per staff member. */
  private List<Object[]> bookingsFor(Tenant tenant, LocalDate day, List<StaffPlan> plans, List<UUID> customers,
      double fillRate, int depositPercent, Instant now) {
    ZoneId zone = tenant.zoneId();
    List<Object[]> rows = new ArrayList<>();
    for (StaffPlan plan : plans) {
      for (LocalTime[] range : plan.hours().getOrDefault(day.getDayOfWeek(), List.of())) {
        Instant cursor = day.atTime(range[0]).atZone(zone).toInstant();
        Instant rangeEnd = day.atTime(range[1]).atZone(zone).toInstant();
        while (cursor.isBefore(rangeEnd)) {
          PlanService service = plan.services().get(random.nextInt(plan.services().size()));
          Instant end = cursor.plus(Duration.ofMinutes(service.blockMinutes()));
          boolean upcoming = cursor.isAfter(now);
          double rate = upcoming ? fillRate * 0.5 : fillRate;
          if (end.isAfter(rangeEnd) || random.nextDouble() > rate) {
            cursor = cursor.plus(Duration.ofMinutes(30));
            continue;
          }
          UUID customer = upcoming && random.nextDouble() < 0.12 ? customers.getFirst()
              : customers.get(1 + random.nextInt(customers.size() - 1));
          String status = upcoming ? "CONFIRMED" : pastStatus();
          long deposit = service.priceCentavos() * depositPercent / 100;
          Instant createdAt = cursor.minus(Duration.ofHours(2 + random.nextInt(24 * 7)));
          rows.add(new Object[] {UUID.randomUUID(), tenant.getId(), customer, plan.membershipId(), service.id(),
              Timestamp.from(cursor), Timestamp.from(end), status, service.priceCentavos(), deposit,
              "CANCELLED".equals(status) ? "Customer cancelled" : null,
              Timestamp.from(createdAt.isAfter(now) ? now : createdAt)});
          cursor = end.plus(Duration.ofMinutes(random.nextInt(3) * 15L));
        }
      }
    }
    return rows;
  }

  /** Who works when and what they do, read back from the database so it follows any edits in the dashboard. */
  private List<StaffPlan> plansFor(Tenant tenant) {
    List<StaffPlan> plans = new ArrayList<>();
    List<UUID> members = jdbc.queryForList(
        "SELECT id FROM membership WHERE tenant_id = ? AND active ORDER BY created_at", UUID.class, tenant.getId());
    for (UUID membershipId : members) {
      List<PlanService> services = jdbc.query("""
          SELECT s.id, s.duration_minutes + s.buffer_minutes AS block, s.price_centavos
          FROM staff_service l JOIN service_offering s ON s.id = l.service_id
          WHERE l.membership_id = ? AND s.active ORDER BY s.name
          """, (rs, n) -> new PlanService(rs.getObject("id", UUID.class), rs.getInt("block"),
          rs.getLong("price_centavos")), membershipId);
      Map<DayOfWeek, List<LocalTime[]>> hours = new EnumMap<>(DayOfWeek.class);
      jdbc.query("SELECT day_of_week, start_time, end_time FROM working_hours WHERE membership_id = ? "
          + "ORDER BY day_of_week, start_time", rs -> {
            hours.computeIfAbsent(DayOfWeek.of(rs.getInt("day_of_week")), d -> new ArrayList<>())
                .add(new LocalTime[] {rs.getObject("start_time", LocalTime.class),
                    rs.getObject("end_time", LocalTime.class)});
          }, membershipId);
      if (!services.isEmpty() && !hours.isEmpty()) {
        plans.add(new StaffPlan(membershipId, services, hours));
      }
    }
    return plans;
  }

  private String pastStatus() {
    double roll = random.nextDouble();
    if (roll < 0.78) {
      return "COMPLETED";
    }
    return roll < 0.86 ? "NO_SHOW" : "CANCELLED";
  }

  private void seedQueue(Tenant tenant, LocalDate today) {
    Instant now = clock.instant();
    List<UUID> services = jdbc.queryForList(
        "SELECT id FROM service_offering WHERE tenant_id = ? AND active ORDER BY price_centavos LIMIT 3",
        UUID.class, tenant.getId());
    if (services.isEmpty()) {
      return;
    }
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
          "+63 919 555 " + String.format("%04d", 2000 + i), services.get(i % services.size()), status,
          Timestamp.from(joined), called == null ? null : Timestamp.from(called),
          finished == null ? null : Timestamp.from(finished)});
    }
    jdbc.batchUpdate("""
        INSERT INTO queue_entry (id, tenant_id, queue_date, ticket_number, customer_name, customer_phone, service_id,
                                 status, joined_at, called_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows);
    jdbc.update("INSERT INTO queue_counter (tenant_id, queue_date, last_number) VALUES (?, ?, ?) "
        + "ON CONFLICT DO NOTHING", tenant.getId(), today, walkIns.length);
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
    linkRepository.flush();
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

  private record PlanService(UUID id, int blockMinutes, long priceCentavos) {
  }

  private record StaffPlan(UUID membershipId, List<PlanService> services, Map<DayOfWeek, List<LocalTime[]>> hours) {
  }
}
