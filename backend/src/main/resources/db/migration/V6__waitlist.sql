-- Early-access waitlist for "QueueUp for families abroad": OFWs who want to book and pay for relatives' visits,
-- and clinics that want those prepaid patients. Not tenant-scoped; read only through the admin CSV export.
CREATE TABLE waitlist_signup (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            VARCHAR(16)  NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(254) NOT NULL,
    phone           VARCHAR(32),
    country         VARCHAR(80),
    family_location VARCHAR(160),
    relation        VARCHAR(40),
    services        VARCHAR(255),
    frequency       VARCHAR(40),
    clinic_name     VARCHAR(160),
    source          VARCHAR(120),
    consented_at    TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT waitlist_kind_valid CHECK (kind IN ('FAMILY', 'CLINIC'))
);

-- One row per person per list; signing up again updates the details instead of adding a duplicate.
CREATE UNIQUE INDEX waitlist_kind_email_uk ON waitlist_signup (kind, lower(email));
CREATE INDEX waitlist_created_idx ON waitlist_signup (kind, created_at);
