-- Bookings. The exclusion constraint is the last line of defence against double booking:
-- no two PENDING_PAYMENT/CONFIRMED bookings may overlap for the same staff member.
-- ends_at includes the service buffer, so buffers are protected by the constraint too.
CREATE TABLE booking (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID         NOT NULL REFERENCES tenant (id),
    customer_id         UUID         NOT NULL REFERENCES app_user (id),
    staff_membership_id UUID         NOT NULL REFERENCES membership (id),
    service_id          UUID         NOT NULL REFERENCES service_offering (id),
    starts_at           TIMESTAMPTZ  NOT NULL,
    ends_at             TIMESTAMPTZ  NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    price_centavos      BIGINT       NOT NULL,
    deposit_centavos    BIGINT       NOT NULL DEFAULT 0,
    notes               VARCHAR(500),
    cancelled_reason    VARCHAR(255),
    version             BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT booking_time_order CHECK (starts_at < ends_at),
    CONSTRAINT booking_status_valid
        CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
    CONSTRAINT booking_amounts_non_negative CHECK (price_centavos >= 0 AND deposit_centavos >= 0),
    CONSTRAINT booking_no_staff_overlap EXCLUDE USING gist (
        staff_membership_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED'))
);
CREATE INDEX booking_tenant_starts_idx ON booking (tenant_id, starts_at);
CREATE INDEX booking_staff_starts_idx ON booking (staff_membership_id, starts_at);
CREATE INDEX booking_customer_idx ON booking (customer_id, starts_at);
CREATE INDEX booking_service_idx ON booking (service_id);
CREATE INDEX booking_pending_created_idx ON booking (created_at) WHERE status = 'PENDING_PAYMENT';
