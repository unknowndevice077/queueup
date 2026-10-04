-- Baseline: extensions, tenants, users, memberships, refresh tokens.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tenant (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                       VARCHAR(120) NOT NULL,
    slug                       VARCHAR(60)  NOT NULL,
    timezone                   VARCHAR(64)  NOT NULL DEFAULT 'Asia/Manila',
    currency                   VARCHAR(3)   NOT NULL DEFAULT 'PHP',
    contact_email              VARCHAR(254),
    contact_phone              VARCHAR(32),
    address                    VARCHAR(255),
    booking_lead_time_minutes  INTEGER      NOT NULL DEFAULT 60,
    cancellation_window_hours  INTEGER      NOT NULL DEFAULT 24,
    deposit_required           BOOLEAN      NOT NULL DEFAULT FALSE,
    deposit_percent            INTEGER      NOT NULL DEFAULT 0,
    status                     VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT tenant_slug_uk UNIQUE (slug),
    CONSTRAINT tenant_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT tenant_lead_time_range CHECK (booking_lead_time_minutes BETWEEN 0 AND 10080),
    CONSTRAINT tenant_cancel_window_range CHECK (cancellation_window_hours BETWEEN 0 AND 720),
    CONSTRAINT tenant_deposit_percent_range CHECK (deposit_percent BETWEEN 0 AND 100),
    CONSTRAINT tenant_status_valid CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

CREATE TABLE app_user (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    full_name      VARCHAR(120) NOT NULL,
    phone          VARCHAR(32),
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT app_user_email_uk UNIQUE (email),
    CONSTRAINT app_user_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE membership (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES app_user (id),
    tenant_id  UUID        NOT NULL REFERENCES tenant (id),
    role       VARCHAR(16) NOT NULL,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT membership_user_tenant_uk UNIQUE (user_id, tenant_id),
    CONSTRAINT membership_role_valid CHECK (role IN ('OWNER', 'STAFF'))
);
CREATE INDEX membership_tenant_idx ON membership (tenant_id);
CREATE INDEX membership_user_idx ON membership (user_id);

CREATE TABLE refresh_token (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES app_user (id),
    family_id   UUID        NOT NULL,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    replaced_by UUID REFERENCES refresh_token (id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT refresh_token_hash_uk UNIQUE (token_hash)
);
CREATE INDEX refresh_token_user_idx ON refresh_token (user_id);
CREATE INDEX refresh_token_family_idx ON refresh_token (family_id);
CREATE INDEX refresh_token_replaced_by_idx ON refresh_token (replaced_by);
