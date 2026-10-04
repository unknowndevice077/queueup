/** API contracts, mirroring the backend DTOs. Money is integer centavos; times are ISO-8601 with offset. */

export type TenantRole = 'OWNER' | 'STAFF';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type QueueStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'DONE' | 'SKIPPED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}

export interface MembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  timezone: string;
  role: TenantRole;
}

export interface MeResponse {
  user: User;
  memberships: MembershipSummary[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCentavos: number;
  active: boolean;
}

export interface PublicTenant {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  bookingLeadTimeMinutes: number;
  cancellationWindowHours: number;
  depositRequired: boolean;
  depositPercent: number;
  services: Service[];
  staff: { id: string; name: string; serviceIds: string[] }[];
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  bookingLeadTimeMinutes: number;
  cancellationWindowHours: number;
  depositRequired: boolean;
  depositPercent: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface StaffAvailability {
  staffId: string;
  staffName: string;
  slots: string[];
}

export interface Booking {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  timezone: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  staffId: string;
  staffName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  priceCentavos: number;
  depositCentavos: number;
  notes?: string;
  cancelledReason?: string;
  customerChangeDeadline: string;
  createdAt: string;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface WorkingHoursRange {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: TenantRole;
  active: boolean;
  serviceIds: string[];
  workingHours: WorkingHoursRange[];
}

export interface Blackout {
  id: string;
  membershipId?: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}

export interface PublicQueueEntry {
  id: string;
  ticketNumber: number;
  status: QueueStatus;
  position: number;
  serviceName?: string;
  calledAt?: string;
}

export interface PublicQueueState {
  tenantSlug: string;
  queueDate: string;
  waitingCount: number;
  entries: PublicQueueEntry[];
  generatedAt: string;
}

export interface StaffQueueEntry {
  id: string;
  ticketNumber: number;
  status: QueueStatus;
  position: number;
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  serviceName?: string;
  joinedAt: string;
  calledAt?: string;
  finishedAt?: string;
  servedBy?: string;
}

export interface QueueTicket {
  id: string;
  queueDate: string;
  ticketNumber: number;
  status: QueueStatus;
  position: number;
  customerName: string;
  serviceName?: string;
  joinedAt: string;
}

export interface PaymentIntent {
  paymentId: string;
  bookingId: string;
  amountCentavos: number;
  status: string;
  checkoutUrl: string;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  timezone: string;
  totals: {
    bookings: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRate: number;
    revenueCentavos: number;
  };
  bookingsPerDay: {
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenueCentavos: number;
  }[];
  topServices: { serviceId: string; name: string; bookings: number; revenueCentavos: number }[];
  busiestHours: { hour: number; bookings: number }[];
}

export interface AuditEntry {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors: { field: string; message: string }[];
  traceId?: string;
}
