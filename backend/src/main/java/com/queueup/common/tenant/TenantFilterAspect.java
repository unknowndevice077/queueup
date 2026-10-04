package com.queueup.common.tenant;

import com.queueup.common.persistence.TenantFilter;
import jakarta.persistence.EntityManager;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.hibernate.Session;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Enables the Hibernate tenant filter on the current session before any repository call made
 * while a tenant context is bound. This is defence in depth: repositories also take an explicit
 * tenant id, so a forgotten filter can never widen a query on its own.
 */
@Aspect
@Component
public class TenantFilterAspect {

  private final EntityManager entityManager;

  public TenantFilterAspect(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Before("execution(* org.springframework.data.repository.Repository+.*(..))")
  public void enableTenantFilter() {
    TenantContext.current().ifPresent(context -> {
      if (!TransactionSynchronizationManager.isActualTransactionActive()) {
        return;
      }
      Session session = entityManager.unwrap(Session.class);
      if (session.getEnabledFilter(TenantFilter.NAME) == null) {
        session.enableFilter(TenantFilter.NAME).setParameter(TenantFilter.PARAM, context.tenantId());
      }
    });
  }
}
