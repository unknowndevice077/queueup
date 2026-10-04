-- Walk-in queue. Ticket numbers restart daily (tenant-local date) and are allocated
-- atomically from queue_counter with INSERT ... ON CONFLICT DO UPDATE.
CREATE TABLE queue_entry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID         NOT NULL REFERENCES tenant (id),
    queue_date     DATE         NOT NULL,
    ticket_number  INTEGER      NOT NULL,
    customer_name  VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(32)  NOT NULL,
    service_id     UUID REFERENCES service_offering (id),
    status         VARCHAR(16)  NOT NULL,
    joined_at      TIMESTAMPTZ  NOT NULL,
    called_at      TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    served_by      UUID REFERENCES membership (id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT queue_entry_ticket_uk UNIQUE (tenant_id, queue_date, ticket_number),
    CONSTRAINT queue_entry_status_valid CHECK (status IN ('WAITING', 'CALLED', 'SERVING', 'DONE', 'SKIPPED'))
);
CREATE INDEX queue_entry_tenant_date_status_idx ON queue_entry (tenant_id, queue_date, status);
CREATE INDEX queue_entry_service_idx ON queue_entry (service_id);
CREATE INDEX queue_entry_served_by_idx ON queue_entry (served_by);

CREATE TABLE queue_counter (
    tenant_id   UUID    NOT NULL REFERENCES tenant (id),
    queue_date  DATE    NOT NULL,
    last_number INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, queue_date)
);
