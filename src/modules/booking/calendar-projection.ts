import { isActiveBookingHold } from '@/modules/core/booking-occupancy';

/**
 * Read-only projection over the canonical Booking and BlockedDate records.
 * This module never writes availability or invents a second calendar authority.
 * All intervals are half-open [startDate, endDate).
 */
export type CalendarState =
  | 'free' | 'request' | 'hold' | 'confirmed' | 'in_house'
  | 'past' | 'owner' | 'maintenance' | 'external' | 'blocked' | 'conflict';

export interface CalendarEntry {
  id: string;
  unitId: string;
  kind: 'booking' | 'block';
  startDate: string;
  endDate: string;
  status: string;
  holdExpiresAt?: string | null;
  channel?: string | null;
  reason?: string | null;
}

export interface CalendarCell {
  state: CalendarState;
  entryIds: string[];
  bookingIds: string[];
  blocking: boolean;
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
export function validCalendarDay(value: string): boolean {
  if (!dayPattern.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function shiftCalendarDay(day: string, offset: number): string {
  if (!validCalendarDay(day)) throw new Error('Invalid calendar date');
  const parsed = new Date(day + 'T00:00:00.000Z');
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}
export function calendarDays(start: string, length: number): string[] {
  if (!Number.isInteger(length) || length < 1 || length > 35) throw new Error('Invalid calendar range');
  return Array.from({ length }, (_, index) => shiftCalendarDay(start, index));
}
export function bangkokCalendarDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  return [part('year'), part('month'), part('day')].join('-');
}
export function coversCalendarDay(entry: CalendarEntry, day: string): boolean {
  return entry.startDate <= day && entry.endDate > day;
}

function entryState(entry: CalendarEntry, day: string, now: Date): CalendarState | null {
  if (!coversCalendarDay(entry, day)) return null;
  if (entry.kind === 'block') {
    if (entry.reason === 'owner_hold') return 'owner';
    if (entry.reason === 'maintenance') return 'maintenance';
    if (entry.reason === 'ota_import') return 'external';
    return 'blocked';
  }
  if (entry.status === 'requested') return 'request'; // enquiries NEVER reserve inventory
  if (entry.status === 'pending_payment') {
    return isActiveBookingHold(entry.holdExpiresAt ? new Date(entry.holdExpiresAt) : null, now) ? 'hold' : null;
  }
  if (entry.status === 'confirmed') return 'confirmed';
  if (entry.status === 'checked_in') return 'in_house';
  if (entry.status === 'checked_out' || entry.status === 'completed') {
    // Historical stay only, not a future availability restriction.
    return day < bangkokCalendarDay(now) ? 'past' : null;
  }
  return null;
}

const rank: Record<CalendarState, number> = {
  free: 0, request: 1, past: 2, hold: 3, blocked: 4, external: 5,
  owner: 6, maintenance: 7, confirmed: 8, in_house: 9, conflict: 10,
};
const blockingStates = new Set<CalendarState>([
  'hold', 'confirmed', 'in_house', 'owner', 'maintenance', 'external', 'blocked',
]);

export function projectCalendarCell(
  entries: CalendarEntry[], unitId: string, day: string, now: Date = new Date(),
): CalendarCell {
  let state: CalendarState = 'free';
  const matched: string[] = [];
  const bookingIds: string[] = [];
  let occupied = 0;
  for (const entry of entries) {
    if (entry.unitId !== unitId) continue;
    const next = entryState(entry, day, now);
    if (!next) continue;
    matched.push(entry.id);
    if (entry.kind === 'booking') bookingIds.push(entry.id);
    if (blockingStates.has(next)) occupied++;
    if (rank[next] > rank[state]) state = next;
  }
  return {
    state: occupied > 1 ? 'conflict' : state,
    entryIds: matched,
    bookingIds,
    blocking: occupied > 0,
  };
}

export function projectCalendar(
  unitIds: string[], days: string[], entries: CalendarEntry[], now: Date = new Date(),
): Record<string, CalendarCell[]> {
  const byUnit = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const list = byUnit.get(entry.unitId) ?? [];
    list.push(entry);
    byUnit.set(entry.unitId, list);
  }
  return Object.fromEntries(unitIds.map((unitId) => [
    unitId,
    days.map((day) => projectCalendarCell(byUnit.get(unitId) ?? [], unitId, day, now)),
  ]));
}
