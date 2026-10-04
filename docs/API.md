# API summary

Interactive docs with full request and response schemas: **`/swagger-ui`** (OpenAPI JSON at `/v3/api-docs`). Locally: http://localhost:8080/swagger-ui or, through nginx, http://localhost:5173/swagger-ui.

Conventions:

- JSON everywhere. Money is integer **centavos**. Timestamps are ISO-8601 with offset in the business's time zone (`2026-10-06T10:00:00+08:00`). Dates are `YYYY-MM-DD` in the business's time zone.
- Auth: `Authorization: Bearer <accessToken>` (15 minutes). Refresh with `POST /api/auth/refresh`.
- Pagination: `?page=0&size=20&sort=startsAt,desc` returns `{ content, page, size, totalElements, totalPages }` (max size 100).
- Errors: RFC 7807 `{ type, title, status, detail, instance, errors: [{ field, message }], traceId }` with `Content-Type: application/problem+json`.
- Status codes: 400 validation, 401 not authenticated, 403 wrong role, 404 not found **or not a member of that business**, 409 conflict (slot taken, duplicate, state), 429 rate limited, 503 payments not configured.

Roles: **Public** (no token), **User** (any signed-in account), **Member** (OWNER or STAFF of the business), **Owner**.

## Auth and profile

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create an account (customer by default). Returns tokens. Rate limited 5/min per IP |
| POST | `/api/auth/login` | Public | Returns `{ accessToken, refreshToken, expiresIn, user }`. Rate limited 5/min per IP |
| POST | `/api/auth/refresh` | Public | Rotate the refresh token. Reusing an old one revokes the whole session family |
| POST | `/api/auth/logout` | Public | Revoke the refresh token family |
| GET | `/api/me` | User | Profile plus memberships `[ { tenantSlug, tenantName, role, ... } ]` |
| GET | `/api/me/bookings` | User | The caller's bookings across all businesses (paginated) |

## Businesses

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/tenants` | User | Create a business; the caller becomes OWNER |
| GET | `/api/public/tenants/{slug}` | Public | Business profile, active services, bookable staff |
| GET | `/api/t/{slug}/settings` | Member | Business settings |
| PATCH | `/api/t/{slug}/settings` | Owner | Name, contact, lead time, cancellation window, deposit |

## Services

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/public/tenants/{slug}/services` | Public | Active services |
| GET | `/api/t/{slug}/services` | Member | All services including hidden ones |
| GET | `/api/t/{slug}/services/{id}` | Member | One service |
| POST | `/api/t/{slug}/services` | Owner | Create |
| PUT | `/api/t/{slug}/services/{id}` | Owner | Replace |
| DELETE | `/api/t/{slug}/services/{id}` | Owner | Hide (soft delete) |

## Staff and schedules

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/t/{slug}/staff` | Member | Members with service ids and weekly hours |
| GET | `/api/t/{slug}/staff/{id}` | Member | One member |
| POST | `/api/t/{slug}/staff` | Owner | Add an existing user by email as STAFF |
| PATCH | `/api/t/{slug}/staff/{id}` | Owner | Change role / active (the last owner is protected) |
| DELETE | `/api/t/{slug}/staff/{id}` | Owner | Deactivate the membership |
| PUT | `/api/t/{slug}/staff/{id}/services` | Owner | Replace which services they perform |
| PUT | `/api/t/{slug}/staff/{id}/working-hours` | Owner | Replace the weekly schedule; several ranges per day allowed |

## Blackouts

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/t/{slug}/blackouts` | Member | Owner: all. Staff: their own and business-wide |
| POST | `/api/t/{slug}/blackouts` | Member | Owner: anyone or whole business. Staff: only themselves |
| PUT | `/api/t/{slug}/blackouts/{id}` | Member | Same rule |
| DELETE | `/api/t/{slug}/blackouts/{id}` | Member | Same rule |

## Availability and bookings

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/public/tenants/{slug}/availability?serviceId=&date=&staffId=` | Public | `[ { staffId, staffName, slots: [ISO start] } ]` |
| POST | `/api/t/{slug}/bookings` | User | Book `{ serviceId, staffId?, startsAt, notes? }`. 409 if taken |
| GET | `/api/t/{slug}/bookings?from=&to=&staffId=&status=` | Member | Calendar search by tenant-local dates (paginated) |
| GET | `/api/t/{slug}/bookings/{id}` | Member or the customer | One booking |
| POST | `/api/t/{slug}/bookings/{id}/cancel` | Customer within window, or Member | `{ reason? }` |
| POST | `/api/t/{slug}/bookings/{id}/complete` | Member | CONFIRMED → COMPLETED |
| POST | `/api/t/{slug}/bookings/{id}/no-show` | Member | CONFIRMED → NO_SHOW, only after start |
| POST | `/api/t/{slug}/bookings/{id}/reschedule` | Customer within window, or Member | `{ startsAt, staffId? }`, same validation as create |

## Walk-in queue

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/public/tenants/{slug}/queue/join` | Public | `{ customerName, customerPhone, serviceId? }` → ticket |
| GET | `/api/public/tenants/{slug}/queue` | Public | Today's tickets and statuses (no names or phones) |
| GET | `/api/t/{slug}/queue` | Member | Staff view with contact details |
| POST | `/api/t/{slug}/queue/call-next` | Member | Lowest waiting ticket → CALLED |
| POST | `/api/t/{slug}/queue/{id}/serve` | Member | → SERVING |
| POST | `/api/t/{slug}/queue/{id}/done` | Member | → DONE |
| POST | `/api/t/{slug}/queue/{id}/skip` | Member | → SKIPPED |

**WebSocket:** STOMP over plain WebSocket at `/ws`. Subscribe to `/topic/tenants/{slug}/queue`; every change pushes the full `PublicQueueState`.

## Payments

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/t/{slug}/bookings/{id}/payment-intent` | Customer or Member | PayMongo Checkout Session for the deposit → `{ checkoutUrl }` |
| POST | `/api/webhooks/paymongo` | PayMongo | Verifies `Paymongo-Signature`, dedupes by event id, `checkout_session.payment.paid` → PAID + CONFIRMED |

## Analytics and audit

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/t/{slug}/analytics/summary?from=&to=` | Owner | Per-day counts and revenue, no-show rate, top services, busiest hours |
| GET | `/api/t/{slug}/analytics/export.csv?from=&to=` | Owner | Bookings as CSV (formula-injection safe) |
| GET | `/api/t/{slug}/audit-log` | Owner | Paginated audit trail |

## Operations

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/actuator/health` | Public | `{ "status": "UP" }` including the database |
