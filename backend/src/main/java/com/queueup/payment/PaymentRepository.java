package com.queueup.payment;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

  Optional<Payment> findByProviderAndProviderReference(PaymentProvider provider, String providerReference);

  Optional<Payment> findFirstByTenantIdAndBookingIdAndStatusOrderByCreatedAtDesc(UUID tenantId, UUID bookingId,
      PaymentStatus status);
}
