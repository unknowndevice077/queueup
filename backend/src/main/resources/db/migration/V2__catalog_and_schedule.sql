-- Services offered, staff-to-service links, working hours and blackouts.
CREATE TABLE service_offering (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID         NOT NULL REFERENCES tenant (id),
    name             VARCHAR(120) NOT NULL,
    description      VARCHAR(1000),
    duration_minutes INTEGER      NOT NULL,
    buffer_minutes   INTEGER      NOT NULL DEFAULT 0,
    price_centavos   BIGINT       NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT service_duration_range CHECK (duration_minutes BETWEEN 5 AND 480),
    CONSTRAINT service_buffer_range CHECK (buffer_minutes BETWEEN 0 AND 240),
    CONSTRAINT service_price_non_negative CHECK (price_centavos >= 0)
);
CREATE INDEX service_offering_tenant_idx ON service_offering (tenant_id);

CREATE TABLE staff_service (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL REFERENCES tenant (id),
    membership_id UUID        NOT NULL REFERENCES membership (id),
    service_id    UUID        NOT NULL REFERENCES service_offering (id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_service_uk UNIQUE (membership_id, service_id)
);
CREATE INDEX staff_service_tenant_idx ON staff_service (tenant_id);
CREATE INDEX staff_service_membership_idx ON staff_service (membership_id);
CREATE INDEX staff_service_service_idx ON staff_service (service_id);

CREATE TABLE working_hours (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL REFERENCES tenant (id),
    membership_id UUID        NOT NULL REFERENCES membership (id),
    day_of_week   SMALLINT    NOT NULL,
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT working_hours_day_range CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT working_hours_order CHECK (start_time < end_time)
);
CREATE INDEX working_hours_tenant_idx ON working_hours (tenant_id);
CREATE INDEX working_hours_membership_day_idx ON working_hours (membership_id, day_of_week);

CREATE TABLE blackout (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL REFERENCES tenant (id),
    membership_id UUID REFERENCES membership (id),
    starts_at     TIMESTAMPTZ  NOT NULL,
    ends_at       TIMESTAMPTZ  NOT NULL,
    reason        VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT blackout_order CHECK (starts_at < ends_at)
);
CREATE INDEX blackout_tenant_starts_idx ON blackout (tenant_id, starts_at);
CREATE INDEX blackout_membership_idx ON blackout (membership_id);
