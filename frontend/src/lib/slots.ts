import type { StaffAvailability } from './types';

/** Pseudo staff id meaning "whoever is free". */
export const ANY_STAFF = 'any';

export interface SlotOption {
  start: string;
  staffId: string | null;
}

/** Merges or filters availability into a sorted, de-duplicated list of start times. */
export function slotOptions(availability: StaffAvailability[], staffId: string): SlotOption[] {
  if (staffId !== ANY_STAFF) {
    const staff = availability.find((a) => a.staffId === staffId);
    return (staff?.slots ?? []).map((start) => ({ start, staffId }));
  }
  const byInstant = new Map<number, string>();
  availability.forEach((a) => a.slots.forEach((slot) => byInstant.set(new Date(slot).getTime(), slot)));
  return [...byInstant.entries()].sort(([a], [b]) => a - b).map(([, start]) => ({ start, staffId: null }));
}
