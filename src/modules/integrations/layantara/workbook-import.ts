import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import type { PrismaClient } from '@prisma/client';
import { createReservationGroup } from '@/modules/booking';
import { parseChannelEvent, type ChannelEvent, type ChannelEventChannel } from './channel-contract';
import { applyChannelEvent } from './channel-service';

/**
 * Layantara operator reservations workbook → canonical bookings.
 *
 * The founder ruled (2026-10-06) that myUNO is Layantara's booking system of
 * record. The operator's reservations sheet is turned into ChannelEvents and
 * applied through the same intake as signed channel events, so every booking
 * gets the same guarantees: idempotent replay, exact protection-block
 * conversion, BookingChange on edits, ledger only for operator-received money,
 * and no guest messaging, TM30 or analytics side effects.
 *
 * Prices are never read from the workbook's price list — system tariffs are
 * the pricing authority. The workbook's revenue is what each stay was
 * actually sold for and is recorded as the booking total.
 */

const SYSTEM_KEY = 'layantara_os';

export type WorkbookStatus = 'confirmed' | 'cancelled' | 'pending' | 'unknown';

export interface WorkbookReservation {
  rowNumber: number;
  ref: string;
  channelLabel: string;
  guestName: string;
  startDate: string;
  endDate: string;
  unitCodes: string[];
  revenueSatang: number;
  status: WorkbookStatus;
  paymentStatus: string;
  amountPaidSatang: number;
  adults: number | null;
  children: number | null;
}

export interface WorkbookProblem { rowNumber: number; ref: string | null; message: string }

// ── xlsx reading ────────────────────────────────────────────────────────────

const decode = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');
const texts = (xml: string) => Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), m => decode(m[1])).join('');

/** Rows of one named sheet as { rowNumber, cells: { A: '...', B: '...' } }. */
export function readXlsxSheet(file: Uint8Array, sheetName: string): Array<{ rowNumber: number; cells: Record<string, string> }> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(file);
  } catch {
    throw new Error('WORKBOOK_UNREADABLE');
  }
  const part = (name: string) => (entries[name] ? strFromU8(entries[name]) : null);
  const workbook = part('xl/workbook.xml');
  const rels = part('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error('WORKBOOK_UNREADABLE');
  const sheet = Array.from(workbook.matchAll(/<sheet\b([^>]*)\/?>/g))
    .map(m => ({ name: decode(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? ''), rid: /\br:id="([^"]*)"/.exec(m[1])?.[1] }))
    .find(s => s.name.trim().toLowerCase() === sheetName.toLowerCase());
  if (!sheet?.rid) throw new Error('WORKBOOK_SHEET_MISSING');
  const target = Array.from(rels.matchAll(/<Relationship\b([^>]*)\/?>/g))
    .map(m => ({ id: /\bId="([^"]*)"/.exec(m[1])?.[1], target: /\bTarget="([^"]*)"/.exec(m[1])?.[1] }))
    .find(r => r.id === sheet.rid)?.target;
  if (!target) throw new Error('WORKBOOK_SHEET_MISSING');
  const path = target.startsWith('/') ? target.slice(1) : target.startsWith('xl/') ? target : 'xl/' + target;
  const xml = part(path);
  if (!xml) throw new Error('WORKBOOK_SHEET_MISSING');
  const shared = Array.from((part('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g), m => texts(m[1]));

  const rows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];
  for (const row of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];
      if (!ref || cell[2] === undefined) continue;
      const type = /\bt="([^"]*)"/.exec(cell[1])?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1];
      if (type === 's' && value !== undefined) cells[ref] = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') cells[ref] = texts(cell[2]);
      else if (value !== undefined) cells[ref] = decode(value);
    }
    rows.push({ rowNumber: Number(row[1]), cells });
  }
  return rows;
}

// ── parsing the Reservations sheet ──────────────────────────────────────────

const COLUMNS = {
  ref: 'booking id', channel: 'channel', guest: 'guest name', checkIn: 'check-in', checkOut: 'check-out',
  rooms: 'rooms', revenue: 'revenue', status: 'booking status', payment: 'payment status',
  paid: 'amount paid', adults: 'adults', children: 'children',
} as const;

function isoDay(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 30000 || serial > 80000) return null;
  // Excel's 1900 date system (with its leap-year bug) is anchored at 1899-12-30.
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}
const satang = (raw: string | undefined) => {
  const n = Number(String(raw ?? '').replace(/[,\s฿]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const count = (raw: string | undefined) => {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
function status(raw: string | undefined): WorkbookStatus {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'confirmed') return 'confirmed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'pending') return 'pending';
  return 'unknown';
}

export function parseReservationsWorkbook(file: Uint8Array): { rows: WorkbookReservation[]; problems: WorkbookProblem[] } {
  const sheet = readXlsxSheet(file, 'Reservations');
  const header = sheet.find(r => Object.values(r.cells).some(v => v.trim().toLowerCase() === 'booking id'));
  if (!header) throw new Error('WORKBOOK_HEADER_MISSING');
  const col: Partial<Record<keyof typeof COLUMNS, string>> = {};
  for (const [letter, label] of Object.entries(header.cells)) {
    const l = label.trim().toLowerCase();
    for (const [field, prefix] of Object.entries(COLUMNS) as Array<[keyof typeof COLUMNS, string]>) {
      if (!col[field] && l.startsWith(prefix)) col[field] = letter;
    }
  }
  for (const required of ['ref', 'channel', 'guest', 'checkIn', 'checkOut', 'rooms', 'revenue', 'status'] as const)
    if (!col[required]) throw new Error('WORKBOOK_COLUMN_MISSING:' + COLUMNS[required]);

  const rows: WorkbookReservation[] = [];
  const problems: WorkbookProblem[] = [];
  const get = (cells: Record<string, string>, field: keyof typeof COLUMNS) => (col[field] ? cells[col[field]!] : undefined);
  for (const { rowNumber, cells } of sheet) {
    if (rowNumber <= header.rowNumber) continue;
    const ref = (get(cells, 'ref') ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(ref)) continue; // blank or summary rows
    const startDate = isoDay(get(cells, 'checkIn'));
    const endDate = isoDay(get(cells, 'checkOut'));
    const unitCodes = (get(cells, 'rooms') ?? '').split(/[,;/]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
    const revenueSatang = satang(get(cells, 'revenue'));
    const guestName = (get(cells, 'guest') ?? '').trim().replace(/\s+/g, ' ');
    const problem = (message: string) => problems.push({ rowNumber, ref, message });
    if (!startDate || !endDate || endDate <= startDate) { problem('dates'); continue; }
    if (!unitCodes.length) { problem('villa'); continue; }
    if (!Number.isSafeInteger(revenueSatang) || revenueSatang < 0) { problem('revenue'); continue; }
    if (guestName.length < 2) { problem('guest'); continue; }
    const paid = satang(get(cells, 'paid'));
    rows.push({
      rowNumber, ref, channelLabel: (get(cells, 'channel') ?? '').trim(), guestName, startDate, endDate,
      unitCodes, revenueSatang, status: status(get(cells, 'status')),
      paymentStatus: (get(cells, 'payment') ?? '').trim(),
      amountPaidSatang: Number.isSafeInteger(paid) && paid > 0 ? paid : 0,
      adults: count(get(cells, 'adults')), children: count(get(cells, 'children')),
    });
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.ref)) problems.push({ rowNumber: row.rowNumber, ref: row.ref, message: 'duplicate_ref' });
    seen.add(row.ref);
  }
  return { rows: rows.filter(r => !problems.some(p => p.ref === r.ref && p.message === 'duplicate_ref')), problems };
}

export function mapChannel(label: string): { channel: ChannelEventChannel; sourceChannelName?: string } {
  const l = label.trim().toLowerCase();
  if (l.startsWith('booking.com') || l === 'booking') return { channel: 'booking_com' };
  if (l.startsWith('agoda')) return { channel: 'agoda' };
  if (l.startsWith('airbnb')) return { channel: 'airbnb' };
  if (l.startsWith('expedia')) return { channel: 'expedia' };
  if (l.startsWith('trip.com') || l.startsWith('trip com') || l.startsWith('trip')) return { channel: 'trip_com' };
  if (l.startsWith('direct')) return { channel: 'direct' };
  if (l.startsWith('walk')) return { channel: 'direct', sourceChannelName: 'Walk in' };
  return { channel: 'agent', sourceChannelName: label.trim().slice(0, 120) || 'Agent' };
}

// ── planning against the database ───────────────────────────────────────────

export type StayAction =
  | 'create' | 'create_cancelled' | 'change' | 'cancel' | 'unchanged' | 'skip';

export interface PlannedStay {
  key: string;
  ref: string;
  rowNumber: number;
  unitCode: string;
  unitId: string | null;
  unitExternalId: string | null;
  guestName: string;
  channel: ChannelEventChannel;
  sourceChannelName?: string;
  startDate: string;
  endDate: string;
  totalSatang: number;
  paidSatang: number;
  alreadyPaidSatang: number;
  adults: number;
  children: number;
  partyUnknown: boolean;
  workbookStatus: WorkbookStatus;
  occupancyId: string | null;
  bookingId: string | null;
  completeAfterImport: boolean;
  action: StayAction;
  reason?: string;
}

export interface ImportPlan {
  systemId: string;
  environment: string;
  today: string;
  stays: PlannedStay[];
  problems: WorkbookProblem[];
  untouchedProtections: Array<{ unitCode: string; startDate: string; endDate: string; reason: string }>;
  summary: Record<StayAction, number> & { reservations: number; problems: number };
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const guestKey = (name: string, channel: string) =>
  'wb-guest:' + createHash('sha256').update(name.trim().toLowerCase() + '|' + channel).digest('hex').slice(0, 32);

/** Each villa's share of a multi-villa reservation, by its arrival-season daily system rate. */
function splitByWeight(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map(w => Math.floor(total * (sum > 0 ? w / sum : 1 / weights.length)));
  shares[0] += total - shares.reduce((a, b) => a + b, 0);
  return shares;
}

function arrivalDailySatang(pricingTerms: unknown, startDate: string): number {
  const grid = (pricingTerms as { tariffGrid?: unknown } | null)?.tariffGrid;
  if (!Array.isArray(grid)) return 0;
  const md = startDate.slice(5);
  for (const row of grid as Array<Record<string, unknown>>) {
    if (row.rateMode !== 'daily' || !Array.isArray(row.dateWindows)) continue;
    const hit = (row.dateWindows as Array<{ start: string; end: string }>).some(w =>
      w.start <= w.end ? w.start <= md && md <= w.end : md >= w.start || md <= w.end);
    if (hit && Number.isSafeInteger(row.amountSatang)) return row.amountSatang as number;
  }
  return 0;
}

export async function planWorkbookImport(
  db: PrismaClient,
  parsed: { rows: WorkbookReservation[]; problems: WorkbookProblem[] },
  now: Date = new Date(),
): Promise<ImportPlan> {
  const system = await db.externalSystem.findFirst({
    where: { system_key: SYSTEM_KEY, status: { in: ['active', 'staging'] } },
    orderBy: { created_at: 'asc' },
  });
  if (!system) throw new Error('LAYANTARA_SYSTEM_MISSING');
  const config = (system.config ?? {}) as Record<string, unknown>;
  if (config.bookingAuthority !== 'myuno' || config.cutoverVerified !== true)
    throw new Error('LAYANTARA_CUTOVER_NOT_VERIFIED');

  const mappings = await db.externalMapping.findMany({ where: { external_system_id: system.id } });
  const unitByCode = new Map<string, { unitId: string; externalId: string }>();
  for (const m of mappings) {
    if (m.entity_type !== 'unit') continue;
    const code = String((m.metadata as Record<string, unknown> | null)?.unit_code ?? '').trim().toUpperCase();
    if (code) unitByCode.set(code, { unitId: m.internal_id, externalId: m.external_id });
  }
  const bookingByKey = new Map(mappings.filter(m => m.entity_type === 'booking').map(m => [m.external_id, m.internal_id]));
  const unitIds = Array.from(unitByCode.values(), u => u.unitId);
  const [bookings, blocks, offerings, payments] = await Promise.all([
    db.booking.findMany({ where: { unitId: { in: unitIds } },
      select: { id: true, unitId: true, status: true, startDate: true, endDate: true, totalThb: true, adults: true, children: true } }),
    db.blockedDate.findMany({ where: { unitId: { in: unitIds } },
      select: { id: true, unitId: true, startDate: true, endDate: true, externalRef: true, reason: true } }),
    db.commercialOffering.findMany({ where: { unitId: { in: unitIds }, offeringType: 'short_term_stay' },
      select: { unitId: true, pricingTerms: true } }),
    db.payment.findMany({ where: { booking: { unitId: { in: unitIds } }, status: 'succeeded' },
      select: { bookingId: true, amountThb: true } }),
  ]);
  const bookingById = new Map(bookings.map(b => [b.id, b]));
  const termsByUnit = new Map(offerings.map(o => [o.unitId!, o.pricingTerms]));
  const paidByBooking = new Map<string, number>();
  for (const p of payments) if (p.bookingId) paidByBooking.set(p.bookingId, (paidByBooking.get(p.bookingId) ?? 0) + p.amountThb);
  const codeByUnit = new Map(Array.from(unitByCode, ([code, u]) => [u.unitId, code]));
  const today = iso(now);
  const usedBlocks = new Set<string>();

  const stays: PlannedStay[] = [];
  for (const row of parsed.rows) {
    const { channel, sourceChannelName } = mapChannel(row.channelLabel);
    const units = row.unitCodes.map(code => ({ code, mapped: unitByCode.get(code) ?? null }));
    const weights = units.map(u => (u.mapped ? arrivalDailySatang(termsByUnit.get(u.mapped.unitId), row.startDate) : 0));
    const totals = splitByWeight(row.revenueSatang, weights);
    const paidShares = splitByWeight(row.amountPaidSatang, weights);
    units.forEach((u, i) => {
      const key = units.length > 1 ? `${row.ref}:${u.code}` : row.ref;
      const bookingId = bookingByKey.get(key) ?? null;
      const existing = bookingId ? bookingById.get(bookingId) ?? null : null;
      const paidWorkbook = /paid|deposit/i.test(row.paymentStatus) && !/unpaid/i.test(row.paymentStatus)
        ? Math.min(paidShares[i], totals[i]) : 0;
      const stay: PlannedStay = {
        key, ref: row.ref, rowNumber: row.rowNumber, unitCode: u.code,
        unitId: u.mapped?.unitId ?? null, unitExternalId: u.mapped?.externalId ?? null,
        guestName: row.guestName, channel, sourceChannelName,
        startDate: row.startDate, endDate: row.endDate, totalSatang: totals[i],
        paidSatang: paidWorkbook, alreadyPaidSatang: bookingId ? paidByBooking.get(bookingId) ?? 0 : 0,
        adults: row.adults && row.adults > 0 ? row.adults : 1, children: row.children ?? 0,
        partyUnknown: !(row.adults && row.adults > 0),
        workbookStatus: row.status, occupancyId: null, bookingId,
        completeAfterImport: false, action: 'skip',
      };
      stays.push(stay);
      if (!u.mapped) { stay.reason = 'unknown_villa'; return; }
      if (row.status === 'pending') { stay.reason = 'pending_kept_protected'; return; }
      if (row.status === 'unknown') { stay.reason = 'unknown_status'; return; }
      const start = new Date(row.startDate + 'T00:00:00Z').getTime();
      const end = new Date(row.endDate + 'T00:00:00Z').getTime();
      const overlaps = <T extends { startDate: Date; endDate: Date; unitId: string }>(x: T) =>
        x.unitId === u.mapped!.unitId && x.startDate.getTime() < end && x.endDate.getTime() > start;

      if (existing) {
        if (row.status === 'cancelled') {
          stay.action = existing.status === 'cancelled' ? 'unchanged' : 'cancel';
          if (['checked_in', 'checked_out', 'completed'].includes(existing.status)) {
            stay.action = 'skip'; stay.reason = 'occupied_stay_needs_manual_cancellation';
          }
          return;
        }
        const same = iso(existing.startDate) === row.startDate && iso(existing.endDate) === row.endDate &&
          existing.totalThb === totals[i] && existing.adults === stay.adults && existing.children === stay.children;
        if (same) stay.action = stay.paidSatang > stay.alreadyPaidSatang ? 'change' : 'unchanged';
        else if (existing.status === 'confirmed') stay.action = 'change';
        else { stay.action = 'skip'; stay.reason = 'stay_already_' + existing.status; }
        if (stay.action !== 'skip') stay.completeAfterImport = row.endDate <= today && existing.status === 'confirmed';
        return;
      }
      const otherBookings = bookings.filter(b => overlaps(b) &&
        ['confirmed', 'checked_in', 'pending_payment'].includes(b.status));
      const unitBlocks = blocks.filter(b => overlaps(b) && !usedBlocks.has(b.id));
      if (row.status === 'cancelled') {
        // History only: a cancelled stay never takes the calendar.
        if (otherBookings.length || unitBlocks.length) { stay.reason = 'cancelled_overlaps_live_stay'; return; }
        stay.action = 'create_cancelled';
        return;
      }
      const exact = unitBlocks.find(b => b.externalRef?.startsWith('layantara:occupancy:') &&
        b.startDate.getTime() === start && b.endDate.getTime() === end);
      if (otherBookings.length || unitBlocks.some(b => b !== exact)) { stay.reason = 'calendar_conflict'; return; }
      if (exact) { stay.occupancyId = exact.externalRef!.slice('layantara:occupancy:'.length); usedBlocks.add(exact.id); }
      stay.action = 'create';
      stay.completeAfterImport = row.endDate <= today;
    });
  }

  const touched = new Set(stays.filter(s => s.occupancyId).map(s => 'layantara:occupancy:' + s.occupancyId));
  const untouchedProtections = blocks
    .filter(b => b.externalRef?.startsWith('layantara:occupancy:') && !touched.has(b.externalRef) &&
      b.endDate.getTime() > now.getTime() - 400 * DAY)
    .map(b => ({ unitCode: codeByUnit.get(b.unitId) ?? '?', startDate: iso(b.startDate), endDate: iso(b.endDate), reason: b.reason }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const summary = { create: 0, create_cancelled: 0, change: 0, cancel: 0, unchanged: 0, skip: 0,
    reservations: parsed.rows.length, problems: parsed.problems.length };
  for (const s of stays) summary[s.action] += 1;
  return { systemId: system.id, environment: system.environment, today, stays, problems: parsed.problems, untouchedProtections, summary };
}

// ── applying ────────────────────────────────────────────────────────────────

export interface AppliedStay { key: string; action: StayAction; status: string; code?: string; bookingId: string | null }

async function ensureIntegrationActor(db: PrismaClient, systemId: string, actorIdentityId: string): Promise<string> {
  const system = await db.externalSystem.findUniqueOrThrow({ where: { id: systemId } });
  const config = (system.config ?? {}) as Record<string, unknown>;
  if (typeof config.integrationActorIdentityId === 'string' && config.integrationActorIdentityId) return config.integrationActorIdentityId;
  // Source-side edits are attributed to a dedicated integration identity,
  // never to the admin who uploaded the file or to the guest.
  const actor = await db.identity.create({ data: { firstName: 'Layantara', lastName: 'Reservations import' } });
  await db.externalSystem.update({ where: { id: systemId }, data: { config: { ...config, integrationActorIdentityId: actor.id } } });
  await db.auditLog.create({ data: {
    actorIdentityId, action: 'layantara.integration_actor_created', entityType: 'ExternalSystem', entityId: systemId,
    data: { integrationActorIdentityId: actor.id },
  } });
  return actor.id;
}

export async function applyWorkbookImport(
  db: PrismaClient,
  plan: ImportPlan,
  input: { actorIdentityId: string; now?: Date },
): Promise<{ applied: AppliedStay[]; groups: number; completed: number }> {
  await ensureIntegrationActor(db, plan.systemId, input.actorIdentityId);
  const now = input.now ?? new Date();
  const runVersion = Math.floor(now.getTime() / 1000) * 100;
  const applied: AppliedStay[] = [];
  let completed = 0;

  const send = async (stay: PlannedStay, step: number, payload: Omit<ChannelEvent, 'contractVersion' | 'eventId' | 'eventVersion' | 'externalBookingId' | 'externalUnitId' | 'occurredAt'>) => {
    const body = {
      contractVersion: 1 as const, eventVersion: runVersion + step,
      externalBookingId: stay.key, externalUnitId: stay.unitExternalId!, occurredAt: now.toISOString(),
      ...payload,
    };
    // Same row content → same event id and the same payload hash, so a
    // re-run reports a duplicate instead of a collision. The run's version
    // and timestamp are deliberately outside the hashed content.
    const content = JSON.stringify({ ...body, eventVersion: 0, occurredAt: '' });
    const eventId = 'wb-' + createHash('sha256').update(content).digest('hex').slice(0, 40);
    const event = parseChannelEvent({ ...body, eventId });
    return applyChannelEvent(db, { event, rawBody: content, environment: plan.environment, operatingRecord: true });
  };
  const bookingPayload = (stay: PlannedStay, eventType: 'booking.confirmed' | 'booking.changed') => ({
    eventType, startDate: stay.startDate, endDate: stay.endDate, channel: stay.channel,
    ...(stay.sourceChannelName ? { sourceChannelName: stay.sourceChannelName } : {}),
    guestExternalId: guestKey(stay.guestName, stay.channel), guestName: stay.guestName,
    adults: stay.adults, children: stay.children, totalSatang: stay.totalSatang, currency: 'THB' as const,
    ...(stay.occupancyId ? { occupancyId: stay.occupancyId } : {}),
  });

  for (const stay of plan.stays) {
    if (stay.action === 'skip' || stay.action === 'unchanged') {
      applied.push({ key: stay.key, action: stay.action, status: stay.action, code: stay.reason, bookingId: stay.bookingId });
      continue;
    }
    let outcome: { status: string; bookingId: string | null; code?: string } = { status: 'processed', bookingId: stay.bookingId };
    if (stay.action === 'create' || stay.action === 'create_cancelled') {
      outcome = await send(stay, 1, bookingPayload(stay, 'booking.confirmed'));
    } else if (stay.action === 'change') {
      const existing = await db.booking.findUnique({ where: { id: stay.bookingId! }, select: { startDate: true, endDate: true, totalThb: true, adults: true, children: true } });
      const differs = !existing || iso(existing.startDate) !== stay.startDate || iso(existing.endDate) !== stay.endDate ||
        existing.totalThb !== stay.totalSatang || existing.adults !== stay.adults || existing.children !== stay.children;
      if (differs) outcome = await send(stay, 1, bookingPayload(stay, 'booking.changed'));
    }
    if (stay.action === 'create_cancelled' || stay.action === 'cancel') {
      if (outcome.status === 'processed' || outcome.status === 'duplicate')
        outcome = { ...(await send(stay, 2, { eventType: 'booking.cancelled' })), bookingId: outcome.bookingId };
    }
    const bookingId = outcome.bookingId ?? stay.bookingId;
    if (bookingId && (outcome.status === 'processed' || outcome.status === 'duplicate') &&
        stay.action !== 'create_cancelled' && stay.action !== 'cancel' && stay.paidSatang > stay.alreadyPaidSatang) {
      // Operator-recorded money only (agents, direct, walk-in). The workbook
      // carries no payment date, so the receipt is dated when recorded.
      const delta = stay.paidSatang - stay.alreadyPaidSatang;
      const pay = await send(stay, 3, {
        eventType: 'payment.received', externalPaymentId: `${stay.key}:paid-to:${stay.paidSatang}`,
        paymentSatang: delta, receiptRef: `workbook:${stay.ref}`, settlement: 'received_by_operator',
      });
      if (pay.status === 'quarantined') outcome = { ...outcome, code: 'payment_' + (pay.code ?? 'quarantined') };
    }
    if (bookingId && stay.completeAfterImport) {
      const done = await db.booking.updateMany({ where: { id: bookingId, status: 'confirmed' }, data: { status: 'completed' } });
      if (done.count) {
        completed += 1;
        await db.auditLog.create({ data: {
          actorIdentityId: input.actorIdentityId, action: 'booking.imported_as_completed', entityType: 'Booking', entityId: bookingId,
          data: { source: 'layantara_workbook', ref: stay.ref, endDate: stay.endDate },
        } });
      }
    }
    applied.push({ key: stay.key, action: stay.action, status: outcome.status, code: outcome.code, bookingId });
  }

  // One reservation across several villas becomes one reservation group.
  let groups = 0;
  const byRef = new Map<string, string[]>();
  for (const a of applied) {
    const stay = plan.stays.find(s => s.key === a.key)!;
    if (a.bookingId && stay.key !== stay.ref) byRef.set(stay.ref, [...(byRef.get(stay.ref) ?? []), a.bookingId]);
  }
  for (const [ref, ids] of Array.from(byRef)) {
    if (ids.length < 2) continue;
    const rows = await db.booking.findMany({ where: { id: { in: ids } }, select: { id: true, guestIdentityId: true, reservationGroupId: true } });
    if (rows.some(r => r.reservationGroupId) || new Set(rows.map(r => r.guestIdentityId)).size !== 1) continue;
    await createReservationGroup(db, { guestIdentityId: rows[0].guestIdentityId, createdByIdentityId: input.actorIdentityId, title: ref, bookingIds: ids });
    groups += 1;
  }

  await db.auditLog.create({ data: {
    actorIdentityId: input.actorIdentityId, action: 'layantara.workbook_import', entityType: 'ExternalSystem', entityId: plan.systemId,
    data: { summary: plan.summary, completed, groups,
      outcomes: applied.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {}) },
  } });
  return { applied, groups, completed };
}
