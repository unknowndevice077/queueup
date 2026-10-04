package com.queueup.schedule;

import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

/** A period when a staff member (or the whole business when membershipId is null) is unavailable. */
@Getter
@Setter
@Entity
@Table(name = "blackout")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class Blackout extends TenantScopedEntity {

  @Column(name = "membership_id")
  private UUID membershipId;

  @Column(name = "starts_at", nullable = false)
  private Instant startsAt;

  @Column(name = "ends_at", nullable = false)
  private Instant endsAt;

  private String reason;

  public boolean isBusinessWide() {
    return membershipId == null;
  }
}
