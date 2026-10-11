import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { PublicQueueState, PublicTenant, StaffAvailability, TenantSettings } from './types';

export const queryKeys = {
  publicTenant: (slug: string) => ['public-tenant', slug] as const,
  availability: (slug: string, serviceId: string, date: string) =>
    ['availability', slug, serviceId, date] as const,
  publicQueue: (slug: string) => ['public-queue', slug] as const,
  settings: (slug: string) => ['settings', slug] as const,
  services: (slug: string) => ['services', slug] as const,
  staff: (slug: string) => ['staff', slug] as const,
  bookings: (slug: string) => ['bookings', slug] as const,
  myBookings: () => ['my-bookings'] as const,
  staffQueue: (slug: string) => ['staff-queue', slug] as const,
  analytics: (slug: string, from: string, to: string) => ['analytics', slug, from, to] as const,
  blackouts: (slug: string) => ['blackouts', slug] as const,
  audit: (slug: string, page: number) => ['audit', slug, page] as const,
};

export function usePublicTenant(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicTenant(slug ?? ''),
    queryFn: () => api.get<PublicTenant>(`/api/public/tenants/${slug}`, { auth: false }),
    enabled: Boolean(slug),
  });
}

export function useAvailability(slug: string, serviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: queryKeys.availability(slug, serviceId ?? '', date ?? ''),
    queryFn: () =>
      api.get<StaffAvailability[]>(
        `/api/public/tenants/${slug}/availability?serviceId=${serviceId}&date=${date}`,
        { auth: false },
      ),
    enabled: Boolean(serviceId && date),
    staleTime: 10_000,
    // Keep the previous day's times on screen (dimmed) while the next day loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function usePublicQueue(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicQueue(slug ?? ''),
    queryFn: () => api.get<PublicQueueState>(`/api/public/tenants/${slug}/queue`, { auth: false }),
    enabled: Boolean(slug),
  });
}

export function useTenantSettings(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.settings(slug ?? ''),
    queryFn: () => api.get<TenantSettings>(`/api/t/${slug}/settings`),
    enabled: Boolean(slug),
  });
}
