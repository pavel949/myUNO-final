import { createHash } from 'node:crypto';

export interface BookingCreationIntent {
  key: string;
  fingerprint: string;
}

export function isBookingCreationKey(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Quotes may expire after a successful write. Recovery returns that frozen stay,
 * so quote tokens and the later accepted ceiling are not part of its identity. */
export function bookingCreationIntent(key: string, stay: {
  unitId?: string; inventoryCategoryId?: string; categoryKey?: string; projectId?: string;
  startDate: Date; endDate: Date; adults: number; children: number; infants: number; pets: number;
  instantBook?: boolean; paymentMethod: string; guestNote?: string;
}): BookingCreationIntent {
  const payload = [
    1, stay.unitId ?? null, stay.inventoryCategoryId ?? null, stay.categoryKey ?? null,
    stay.projectId ?? null, stay.startDate.toISOString(), stay.endDate.toISOString(),
    stay.adults, stay.children, stay.infants, stay.pets,
    stay.unitId ? stay.instantBook : null, stay.paymentMethod, stay.guestNote ?? null,
  ];
  return { key: key.toLowerCase(), fingerprint: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
