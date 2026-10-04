/**
 * Shared persistence infrastructure. Declares the tenant Hibernate filter used by every
 * {@link com.queueup.common.persistence.TenantScopedEntity}.
 */
@FilterDef(
    name = TenantFilter.NAME,
    parameters = @ParamDef(name = TenantFilter.PARAM, type = UUID.class))
package com.queueup.common.persistence;

import java.util.UUID;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
