package com.queueup.queue;

import com.queueup.catalog.ServiceOffering;
import com.queueup.common.persistence.TenantFilter;
import com.queueup.common.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Filter;

@Getter
@Setter
@Entity
@Table(name = "queue_entry")
@Filter(name = TenantFilter.NAME, condition = TenantFilter.CONDITION)
public class QueueEntry extends TenantScopedEntity {

  /** Tenant-local calendar date the ticket belongs to; ticket numbers restart each day. */
  @Column(name = "queue_date", nullable = false, updatable = false)
  private LocalDate queueDate;

  @Column(name = "ticket_number", nullable = false, updatable = false)
  private int ticketNumber;

  @Column(name = "customer_name", nullable = false, length = 120)
  private String customerName;

  @Column(name = "customer_phone", nullable = false, length = 32)
  private String customerPhone;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "service_id")
  private ServiceOffering service;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private QueueStatus status;

  @Column(name = "joined_at", nullable = false)
  private Instant joinedAt;

  @Column(name = "called_at")
  private Instant calledAt;

  @Column(name = "finished_at")
  private Instant finishedAt;

  @Column(name = "served_by")
  private UUID servedBy;
}
