CREATE TABLE payment (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL REFERENCES tenant (id),
    booking_id         UUID         NOT NULL REFERENCES booking (id),
    provider           VARCHAR(16)  NOT NULL,
    provider_reference VARCHAR(100),
    checkout_url       VARCHAR(500),
    amount_centavos    BIGINT       NOT NULL,
    status             VARCHAR(16)  NOT NULL,
    raw_payload        JSONB,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT payment_provider_valid CHECK (provider IN ('PAYMONGO')),
    CONSTRAINT payment_status_valid CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    CONSTRAINT payment_amount_positive CHECK (amount_centavos > 0)
);
CREATE INDEX payment_tenant_idx ON payment (tenant_id);
CREATE INDEX payment_booking_idx ON payment (booking_id);
CREATE UNIQUE INDEX payment_provider_reference_uk ON payment (provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE TABLE webhook_event (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider     VARCHAR(16)  NOT NULL,
    event_id     VARCHAR(100) NOT NULL,
    event_type   VARCHAR(100),
    received_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT webhook_event_event_uk UNIQUE (event_id)
);

CREATE TABLE notification_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL REFERENCES tenant (id),
    booking_id UUID         NOT NULL REFERENCES booking (id),
    type       VARCHAR(20)  NOT NULL,
    channel    VARCHAR(10)  NOT NULL,
    recipient  VARCHAR(254) NOT NULL,
    sent_at    TIMESTAMPTZ,
    status     VARCHAR(10)  NOT NULL,
    error      VARCHAR(500),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT notification_type_valid CHECK (type IN ('CONFIRMATION', 'REMINDER_24H', 'CANCELLATION')),
    CONSTRAINT notification_channel_valid CHECK (channel IN ('EMAIL', 'SMS')),
    CONSTRAINT notification_status_valid CHECK (status IN ('SENT', 'FAILED'))
);
CREATE INDEX notification_log_tenant_idx ON notification_log (tenant_id);
CREATE INDEX notification_log_booking_idx ON notification_log (booking_id);
-- Idempotency: at most one successful notification of each type per booking and channel.
CREATE UNIQUE INDEX notification_log_sent_uk ON notification_log (booking_id, type, channel)
    WHERE status = 'SENT';

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL REFERENCES tenant (id),
    actor_user_id UUID REFERENCES app_user (id),
    action        VARCHAR(60)  NOT NULL,
    entity_type   VARCHAR(40)  NOT NULL,
    entity_id     UUID,
    details       JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_created_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id);
