# Architecture

QueueUp is a modular monolith: one Spring Boot service with feature packages, one PostgreSQL database, and a React single-page app. This page explains how a request flows, how tenants are kept apart, and what the data looks like.

## System context

```mermaid
flowchart LR
  subgraph Browser
    SPA[React SPA<br/>Vite + TanStack Query]
    TV[Now Serving board<br/>/b/:slug/display]
  end
  SPA -- "REST /api (JWT)" --> API
  SPA -- "STOMP over WebSocket /ws" --> API
  TV -- "STOMP /topic/tenants/:slug/queue" --> API
  subgraph Backend[Spring Boot 3 / Java 21]
    API[Controllers] --> SVC[Services]
    SVC --> REPO[Spring Data JPA + JDBC]
    SVC -- "events, after commit" --> NOTIFY[Notification listener @Async]
    SVC -- "events, after commit" --> BROADCAST[Queue broadcaster]
    JOBS[Scheduled jobs<br/>expiry + reminders] --> SVC
  end
  REPO --> PG[(PostgreSQL 16<br/>Flyway, btree_gist)]
  NOTIFY --> SMTP[SMTP<br/>Mailpit locally]
  SVC -- "Checkout Sessions API" --> PM[PayMongo]
  PM -- "signed webhooks" --> API
  BROADCAST --> API
```

## Request pipeline

```mermaid
sequenceDiagram
  participant C as Client
  participant T as TraceIdFilter
  participant R as AuthRateLimitFilter
  participant J as JwtAuthenticationFilter
  participant TR as TenantResolutionFilter
  participant S as Spring Security authz
  participant CT as Controller
  participant SV as Service (@Transactional)
  participant A as TenantFilterAspect
  participant DB as PostgreSQL
  C->>T: request
  T->>T: MDC traceId, X-Trace-Id header
  T->>R: login/register only: 5/min per IP
  R->>J: verify Bearer token (HS256)
  J->>TR: /api/t/{slug} or /api/public/tenants/{slug}
  TR->>DB: tenant by slug + caller membership
  TR->>S: TenantContext bound (thread-local)
  S->>CT: authenticated()/permitAll
  CT->>SV: DTO in
  SV->>SV: TenantAccess.requireMember()/requireOwner()
  SV->>A: repository call
  A->>DB: enable Hibernate tenantFilter, run tenant-scoped query
  SV-->>CT: DTO out (MapStruct)
  CT-->>C: JSON or RFC 7807 problem
```

- **No business logic in controllers.** Controllers map HTTP to service calls, nothing else.
- **DTOs only.** Entities never leave the service layer; MapStruct (`BookingMapper`, `ServiceMapper`, `TenantMapper`, `UserMapper`) or small records do the mapping.
- **Transactions.** Writes use `@Transactional`, reads use `readOnly = true`. Open-session-in-view is off.
- **Errors.** `GlobalExceptionHandler` maps everything to `ApiError` (RFC 7807 plus `errors[]` and `traceId`). Filters and security entry points use the same writer.

## Packages

| Package | Responsibility |
|---|---|
| `config` | Security, CORS, WebSocket, OpenAPI, async executor, scheduling switch, typed `AppProperties`, `DATABASE_URL` normaliser |
| `common` | Base entities, tenant filter definition, `TenantContext`/`TenantAccess`, exceptions, problem responses, trace id, pagination, validation |
| `auth` | Register/login/refresh/logout, JWT, refresh-token rotation, rate limiting |
| `tenant` | Businesses, public profile, settings, tenant resolution filter |
| `user` | Users, memberships, staff management, `/api/me` |
| `catalog` | Services and staff-to-service links |
| `schedule` | Weekly working hours and blackouts |
| `booking` | Slot engine, availability, booking lifecycle, expiry job |
| `queue` | Walk-in queue, ticket counter, STOMP broadcaster |
| `payment` | PayMongo checkout, webhook verification and idempotency |
| `notification` | Sender abstraction, email templates, reminder job, notification log |
| `analytics` | Dashboard aggregates and CSV export (SQL in the tenant time zone) |
| `audit` | Append-only audit log |
| `seed` | Demo data (only when `SEED_DEMO=true`) |

## Booking: from slot to confirmation

```mermaid
sequenceDiagram
  participant U as Customer
  participant API as BookingService
  participant AV as AvailabilityService + SlotEngine
  participant DB as PostgreSQL
  participant PM as PayMongo
  U->>API: POST /api/t/{slug}/bookings {serviceId, staffId?, startsAt}
  API->>AV: re-run availability for that date
  AV->>DB: hours, blackouts, blocking bookings (5 queries)
  AV-->>API: staff whose slots include startsAt (else 409)
  API->>DB: INSERT booking (ends_at = start + duration + buffer)
  alt overlap (23P01) or race deadlock (40P01)
    DB-->>API: error
    API-->>U: 409 Slot no longer available
  else deposit not required
    API-->>U: 201 CONFIRMED (+ email after commit)
  else deposit required
    API-->>U: 201 PENDING_PAYMENT
    U->>API: POST .../payment-intent
    API->>PM: create Checkout Session (metadata: booking, payment)
    API-->>U: checkoutUrl
    PM->>API: webhook checkout_session.payment.paid (signed)
    API->>DB: dedupe event id, payment PAID, booking CONFIRMED
  end
  Note over API,DB: Unpaid PENDING_PAYMENT bookings are cancelled after 15 minutes
```

### Slot engine

For one staff member on one tenant-local date:

1. Convert the weekday's working ranges (several per day model lunch breaks) to UTC intervals with `ZonedDateTime`.
2. Subtract busy intervals: business-wide and staff blackouts, and `PENDING_PAYMENT`/`CONFIRMED` bookings (whose `ends_at` already includes their buffer).
3. Walk the local clock in 15-minute steps; keep a start when `[start, start + duration + buffer]` lies inside a free interval.
4. Drop starts before `now + booking_lead_time_minutes` (so past dates yield nothing).
5. Return `ZonedDateTime`s, serialised as ISO-8601 with offset (`2026-10-06T10:00:00+08:00`).

## Live queue

```mermaid
sequenceDiagram
  participant W as Walk-in phone
  participant S as Staff console
  participant API as QueueService
  participant DB as PostgreSQL
  participant B as QueueBroadcaster
  participant TV as TV board / phones
  W->>API: POST /api/public/tenants/{slug}/queue/join
  API->>DB: upsert queue_counter -> ticket #n, insert WAITING
  S->>API: POST /api/t/{slug}/queue/call-next
  API->>DB: SELECT ... FOR UPDATE SKIP LOCKED, set CALLED
  API-->>B: QueueChangedEvent (after commit)
  B->>TV: /topic/tenants/{slug}/queue full public state
```

## Entity relationship diagram

```mermaid
erDiagram
  TENANT ||--o{ MEMBERSHIP : has
  APP_USER ||--o{ MEMBERSHIP : "works at"
  APP_USER ||--o{ REFRESH_TOKEN : owns
  TENANT ||--o{ SERVICE_OFFERING : offers
  MEMBERSHIP ||--o{ STAFF_SERVICE : performs
  SERVICE_OFFERING ||--o{ STAFF_SERVICE : "performed by"
  MEMBERSHIP ||--o{ WORKING_HOURS : works
  TENANT ||--o{ BLACKOUT : closes
  MEMBERSHIP |o--o{ BLACKOUT : "is away"
  TENANT ||--o{ BOOKING : receives
  APP_USER ||--o{ BOOKING : books
  MEMBERSHIP ||--o{ BOOKING : serves
  SERVICE_OFFERING ||--o{ BOOKING : "booked as"
  BOOKING ||--o{ PAYMENT : "paid by"
  BOOKING ||--o{ NOTIFICATION_LOG : notifies
  TENANT ||--o{ QUEUE_ENTRY : queues
  SERVICE_OFFERING |o--o{ QUEUE_ENTRY : wants
  TENANT ||--o{ QUEUE_COUNTER : numbers
  TENANT ||--o{ AUDIT_LOG : records

  TENANT {
    uuid id PK
    varchar slug UK
    varchar timezone
    varchar currency
    int booking_lead_time_minutes
    int cancellation_window_hours
    bool deposit_required
    int deposit_percent
    varchar status
  }
  APP_USER {
    uuid id PK
    varchar email UK
    varchar password_hash
    varchar full_name
    bool email_verified
    bool enabled
  }
  MEMBERSHIP {
    uuid id PK
    uuid user_id FK
    uuid tenant_id FK
    varchar role "OWNER | STAFF"
    bool active
  }
  REFRESH_TOKEN {
    uuid id PK
    uuid user_id FK
    uuid family_id
    varchar token_hash UK
    timestamptz expires_at
    timestamptz revoked_at
    uuid replaced_by FK
  }
  SERVICE_OFFERING {
    uuid id PK
    uuid tenant_id FK
    varchar name
    int duration_minutes "5-480"
    int buffer_minutes
    bigint price_centavos
    bool active
  }
  STAFF_SERVICE {
    uuid id PK
    uuid tenant_id FK
    uuid membership_id FK
    uuid service_id FK
  }
  WORKING_HOURS {
    uuid id PK
    uuid tenant_id FK
    uuid membership_id FK
    smallint day_of_week "1-7"
    time start_time
    time end_time
  }
  BLACKOUT {
    uuid id PK
    uuid tenant_id FK
    uuid membership_id FK "null = whole business"
    timestamptz starts_at
    timestamptz ends_at
  }
  BOOKING {
    uuid id PK
    uuid tenant_id FK
    uuid customer_id FK
    uuid staff_membership_id FK
    uuid service_id FK
    timestamptz starts_at
    timestamptz ends_at "incl. buffer"
    varchar status
    bigint price_centavos
    bigint deposit_centavos
    bigint version
  }
  PAYMENT {
    uuid id PK
    uuid tenant_id FK
    uuid booking_id FK
    varchar provider_reference UK
    bigint amount_centavos
    varchar status
    jsonb raw_payload
  }
  WEBHOOK_EVENT {
    uuid id PK
    varchar event_id UK
    timestamptz received_at
    timestamptz processed_at
  }
  QUEUE_ENTRY {
    uuid id PK
    uuid tenant_id FK
    date queue_date
    int ticket_number
    varchar status
    uuid served_by FK
  }
  QUEUE_COUNTER {
    uuid tenant_id PK
    date queue_date PK
    int last_number
  }
  NOTIFICATION_LOG {
    uuid id PK
    uuid tenant_id FK
    uuid booking_id FK
    varchar type
    varchar channel
    varchar status
  }
  AUDIT_LOG {
    uuid id PK
    uuid tenant_id FK
    uuid actor_user_id FK
    varchar action
    jsonb details
  }
```

All tables also carry `created_at` and `updated_at`. Every foreign key is indexed, plus `booking (tenant_id, starts_at)` and `booking (staff_membership_id, starts_at)`.

Key constraints:

- `booking_no_staff_overlap`: `EXCLUDE USING gist (staff_membership_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('PENDING_PAYMENT','CONFIRMED'))`
- `notification_log_sent_uk`: unique `(booking_id, type, channel) WHERE status = 'SENT'`
- `queue_entry_ticket_uk`: unique `(tenant_id, queue_date, ticket_number)`
- `webhook_event_event_uk`: unique `(event_id)`

## Observability

- `X-Trace-Id` on every response, also in every error body and in the log MDC (propagated into async notification threads).
- `prod` profile logs JSON (Logstash encoder) with `traceId`, `tenant` and `userId` fields; other profiles log readable lines.
- `/actuator/health` is public (with DB check, no details); every other actuator endpoint is denied.
- Passwords, tokens and webhook payloads are never logged; request DTOs override `toString()` to redact secrets.
