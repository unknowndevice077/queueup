package com.queueup.booking;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

  @EntityGraph(attributePaths = {"customer", "staff", "staff.user", "service"})
  Optional<Booking> findDetailedByIdAndTenantId(UUID id, UUID tenantId);

  @EntityGraph(attributePaths = {"customer", "staff", "staff.user", "service"})
  Optional<Booking> findDetailedById(UUID id);

  @Query("""
      select b from Booking b
      where b.tenantId = :tenantId
        and b.staff.id in :staffIds
        and b.status in :statuses
        and b.startsAt < :to and b.endsAt > :from
      """)
  List<Booking> findOverlapping(@Param("tenantId") UUID tenantId, @Param("staffIds") Collection<UUID> staffIds,
      @Param("statuses") Collection<BookingStatus> statuses, @Param("from") Instant from, @Param("to") Instant to);

  @EntityGraph(attributePaths = {"customer", "staff", "staff.user", "service"})
  @Query("""
      select b from Booking b
      where b.tenantId = :tenantId
        and b.startsAt >= :from and b.startsAt < :to
        and (:staffId is null or b.staff.id = :staffId)
        and (:status is null or b.status = :status)
      """)
  Page<Booking> search(@Param("tenantId") UUID tenantId, @Param("from") Instant from, @Param("to") Instant to,
      @Param("staffId") UUID staffId, @Param("status") BookingStatus status, Pageable pageable);

  @EntityGraph(attributePaths = {"staff", "staff.user", "service"})
  @Query("select b from Booking b where b.customer.id = :customerId")
  Page<Booking> findForCustomer(@Param("customerId") UUID customerId, Pageable pageable);

  @Query("select b.id from Booking b where b.status = :status and b.createdAt < :cutoff")
  List<UUID> findIdsByStatusCreatedBefore(@Param("status") BookingStatus status, @Param("cutoff") Instant cutoff);

  @Query("""
      select b.id from Booking b
      where b.status = com.queueup.booking.BookingStatus.CONFIRMED
        and b.startsAt > :now and b.startsAt <= :until
        and not exists (
          select 1 from NotificationLog n
          where n.bookingId = b.id
            and n.type = com.queueup.notification.NotificationType.REMINDER_24H
            and n.status = com.queueup.notification.NotificationStatus.SENT)
      """)
  List<UUID> findIdsNeedingReminder(@Param("now") Instant now, @Param("until") Instant until);
}
