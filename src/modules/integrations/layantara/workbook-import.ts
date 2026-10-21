import { applyReviewedImportedGroup, groupProtectionMatches } from './imported-group.service';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import type { PrismaClient } from '@prisma/client';
import { bangkokCalendarDay } from '@/modules/booking/calendar-projection';
import { createReservationGroup } from '@/modules/booking';
import { parseChannelEvent, type ChannelEvent, type ChannelEventChannel } from './channel-contract';
import { applyChannelEvent } from './channel-service';
import { readReviewedWorkbook, evidenceDigest, reviewedGuestKey, type WorkbookReviewContext, type SourceOperationalDetails, type ReviewedWorkbookGroupEntry } from './reviewed-workbook';

/**
 * Layantara operator reservations workbook → canonical bookings.
 *
 * The founder ruled (2026-10-06) that myUNO is Layantara's booking system of
 * record. The operator's reservations sheet is turned into ChannelEvents and
 * applied through the same intake as signed channel events, so every booking
 * gets the same guarantees: idempotent replay, protected inventory preserved, BookingChange on edits, no inferred receipts,
 * and no guest messaging, TM30 or analytics side effects.
 *
 * Prices are never read from the workbook's price list — system tariffs are
 * the pricing authority. The workbook's revenue is what each stay was
 * actually sold for and is recorded as the booking total.
 */

const SYSTEM_KEY = 'layantara_os';
/** Only the source's documented RES numeric namespace is case insensitive. */
export const normalizeWorkbookReference = (value: string) => value.replace(/^res-(\d+)(?=:|$)/i, 'RES-$1');

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
  operationalDetails?: SourceOperationalDetails;
}

export interface SourcePayment {
  rowNumber: number;
  ref: string | null;
  paymentStatus: string;
  amountPaidRaw: string;
  amountPaidSatang: number | null;
}
export interface ApplyBlocker extends WorkbookProblem {
  paymentStatus?: string;
  amountPaidRaw?: string;
  unitCode?: string;
}

function paymentBlocker(source: SourcePayment): ApplyBlocker | null {
  const normalized = source.amountPaidRaw.replace(/[,\s฿]/g, '');
  // Require an actual numeric zero before rounding; sub-satang payments are not unpaid.
  const explicitZero = /^[+]?(?:0+(?:\.0*)?|\.0+)$/.test(normalized);
  if (source.paymentStatus.trim().toLowerCase() === 'unpaid' && explicitZero) return null;
  return { rowNumber: source.rowNumber, ref: source.ref, message: 'source_payment_unverified',
    paymentStatus: source.paymentStatus, amountPaidRaw: source.amountPaidRaw };
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
  contact: 'contact', notes: 'notes', rateType: 'rate type', breakfast: 'breakfast',
  dietary: 'dietary', servicesIncluded: 'services included', servicesExcluded: 'services excluded',
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
  if (raw === undefined || raw.trim() === '') return NaN;
  const normalized = String(raw).replace(/[,\s฿]/g, '');
  if (!normalized) return NaN;
  const n = Number(normalized);
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

export function parseReservationsWorkbook(file: Uint8Array): { rows: WorkbookReservation[]; problems: WorkbookProblem[]; sourcePayments: SourcePayment[]; workbookSha256?: string } {
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
  const sourcePayments: SourcePayment[] = [];
  const get = (cells: Record<string, string>, field: keyof typeof COLUMNS) => (col[field] ? cells[col[field]!] : undefined);
  for (const { rowNumber, cells } of sheet) {
    if (rowNumber <= header.rowNumber) continue;
    const rawRef = (get(cells, 'ref') ?? '').trim();
    const ref = normalizeWorkbookReference(rawRef);
    // Capture payment evidence before any validation/status/duplicate filtering.
    // Only blank rows and explicitly labelled totals without stay fields are summaries.
    const hasStayFields = ['guest', 'checkIn', 'checkOut', 'rooms', 'channel', 'status']
      .some(field => (get(cells, field as keyof typeof COLUMNS) ?? '').trim() !== '');
    if (!Object.values(cells).some(value => value.trim())) continue;
    // The operator template pre-fills derived Avg/night and Balance formula
    // zeros far below the last reservation. Ignore only these otherwise empty
    // template rows; payment/source facts or other content still require review.
    const derivedColumns = new Set(Object.entries(header.cells)
      .filter(([, label]) => /^(avg\.?\/night|balance)$/i.test(label.trim())).map(([letter]) => letter));
    if (!ref && !hasStayFields && Object.entries(cells).every(([letter, value]) =>
      !value.trim() || (derivedColumns.has(letter) && /^[+]?(?:0+(?:\.0*)?|\.0+)$/.test(value.trim())))) continue;
    if (/^(grand total|total|subtotal)$/i.test(ref) && !hasStayFields) continue;
    const amountPaidRaw = get(cells, 'paid') ?? '';
    const paid = satang(amountPaidRaw);
    sourcePayments.push({ rowNumber, ref: ref || null,
      paymentStatus: (get(cells, 'payment') ?? '').trim(), amountPaidRaw,
      amountPaidSatang: amountPaidRaw.trim() && Number.isSafeInteger(paid) && paid >= 0 ? paid : null });
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(ref)) {
      problems.push({ rowNumber, ref: ref || null, message: 'booking_ref' });
      continue;
    }
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
    const operationalDetails: SourceOperationalDetails = {};
    if (rawRef !== ref) operationalDetails.sourceReferenceRaw = rawRef;
    for (const field of ['contact','notes','rateType','breakfast','dietary','servicesIncluded','servicesExcluded'] as const) {
      const value = (get(cells, field) ?? '').trim();
      if (value.length > 4000) { problem('operational_details_too_long'); }
      if (value) operationalDetails[field] = value;
    }
    rows.push({
      ...(Object.keys(operationalDetails).length ? { operationalDetails } : {}),
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
  return { rows: rows.filter(r => !problems.some(p => p.ref === r.ref && p.message === 'duplicate_ref')), problems, sourcePayments, workbookSha256: createHash('sha256').update(file).digest('hex') };
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
  review?: WorkbookReviewContext;
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
  sourceReservationTotalSatang?: number;
  totalSatang: number;
  paidSatang: number;
  sourcePaymentStatus: string;
  sourcePaymentAmountRaw: string;
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

export interface PlannedSourceGroup {
  ref: string;
  review: WorkbookReviewContext;
  entry: ReviewedWorkbookGroupEntry;
  action: 'create' | 'unchanged' | 'skip';
  reason?: string;
}

export interface ImportPlan {
  sourceGroups?: PlannedSourceGroup[];
  reviewedSource?: boolean;
  systemId: string;
  environment: string;
  today: string;
  stays: PlannedStay[];
  problems: WorkbookProblem[];
  applyBlockers: ApplyBlocker[];
  untouchedProtections: Array<{ unitCode: string; startDate: string; endDate: string; reason: string }>;
  summary: Record<StayAction, number> & { reservations: number; problems: number };
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

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
  parsed: ReturnType<typeof parseReservationsWorkbook>,
  now: Date = new Date(),
  options: { reviewedSource?: boolean; currentOnly?: boolean } = {},
): Promise<ImportPlan> {
  const system = await db.externalSystem.findFirst({
    where: { system_key: SYSTEM_KEY, status: { in: ['active', 'staging'] } },
    orderBy: { created_at: 'asc' },
  });
  if (!system) throw new Error('LAYANTARA_SYSTEM_MISSING');
  const config = (system.config ?? {}) as Record<string, unknown>;
  if (config.bookingAuthority !== 'myuno' || config.cutoverVerified !== true)
    throw new Error('LAYANTARA_CUTOVER_NOT_VERIFIED');

  const reviewManifest = options.reviewedSource ? readReviewedWorkbook(config, parsed.workbookSha256 ?? '') : null;
  const mappings = await db.externalMapping.findMany({ where: { external_system_id: system.id } });
  const unitByCode = new Map<string, { unitId: string; externalId: string }>();
  for (const m of mappings) {
    if (m.entity_type !== 'unit') continue;
    const code = String((m.metadata as Record<string, unknown> | null)?.unit_code ?? '').trim().toUpperCase();
    if (code) unitByCode.set(code, { unitId: m.internal_id, externalId: m.external_id });
  }
  const bookingMappings = mappings.filter(m => m.entity_type === 'booking');
  const referenceAliases = new Set(bookingMappings.filter(m => normalizeWorkbookReference(m.external_id) !== m.external_id).map(m => normalizeWorkbookReference(m.external_id)));
  const bookingByKey = new Map(bookingMappings.map(m => [m.external_id, m.internal_id]));
  const unitIds = Array.from(unitByCode.values(), u => u.unitId);
  const [bookings, blocks, offerings, payments] = await Promise.all([
    db.booking.findMany({ where: { unitId: { in: unitIds } },
      select: { id: true, unitId: true, status: true, startDate: true, endDate: true, totalThb: true, adults: true, children: true } }),
    db.blockedDate.findMany({ where: { unitId: { in: unitIds } },
      select: { id: true, unitId: true, startDate: true, endDate: true, externalRef: true, reason: true, note: true, updatedAt: true } }),
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
  const today = bangkokCalendarDay(now);
  const scopedRows = parsed.rows.filter(row => !options.currentOnly || row.endDate > today);
  const scopedRowNumbers = new Set(scopedRows.map(row => row.rowNumber));
  const applyBlockers: ApplyBlocker[] = reviewManifest ? [] : parsed.sourcePayments.filter(source => !options.currentOnly || scopedRowNumbers.has(source.rowNumber)).flatMap(source => {
    const blocker = paymentBlocker(source);
    return blocker ? [blocker] : [];
  });

  applyBlockers.push(...parsed.problems);
  const stays: PlannedStay[] = [];
  const sourceGroups: PlannedSourceGroup[] = [];
  for (const row of scopedRows) {
    const { channel, sourceChannelName } = mapChannel(row.channelLabel);
    const reviewedUnit = row.unitCodes.length === 1 ? reviewManifest?.entries.find(e => e.ref === row.ref) : undefined;
    // A reviewed row digest binds the source villa code, including explicit aliases.
    // Resolve only the reviewed canonical pair, never a fuzzy/global alias.
    const reviewedMapping = reviewedUnit ? Array.from(unitByCode.values()).find(u =>
      u.unitId === reviewedUnit.unitId && u.externalId === reviewedUnit.unitExternalId) : undefined;
    const groupEntry = reviewManifest?.groups?.find(group => group.ref === row.ref);
    const units = row.unitCodes.map(code => {
      const groupPlacement = groupEntry?.placements.find(p => p.unitCode === code);
      const groupMapping = groupPlacement ? Array.from(unitByCode.values()).find(u =>
        u.unitId === groupPlacement.unitId && u.externalId === groupPlacement.unitExternalId) : undefined;
      return { code, mapped: groupMapping ?? reviewedMapping ?? unitByCode.get(code) ?? null };
    });
    let sourceGroup: PlannedSourceGroup | undefined;
    if (units.length > 1 && groupEntry && reviewManifest && row.status === 'confirmed') {
      const source = parsed.sourcePayments.find(p => p.rowNumber === row.rowNumber)!;
      sourceGroup = { ref: row.ref, entry: groupEntry, action: 'skip', review: {
        workbookSha256: reviewManifest.workbookSha256, manifestDigest: evidenceDigest(reviewManifest),
        ref: row.ref, rowDigest: groupEntry.rowDigest,
      } };
      sourceGroups.push(sourceGroup);
      if (groupEntry.rowDigest !== evidenceDigest({ row, source }) || groupEntry.totalSatang !== row.revenueSatang ||
          groupEntry.guestName !== row.guestName || groupEntry.channel !== channel || groupEntry.sourceChannelName !== sourceChannelName ||
          groupEntry.startDate !== row.startDate || groupEntry.endDate !== row.endDate || groupEntry.adults !== row.adults ||
          groupEntry.children !== row.children || groupEntry.rawStatus !== source.paymentStatus || groupEntry.reportedPaidSatang !== source.amountPaidSatang ||
          evidenceDigest(groupEntry.operationalDetails ?? {}) !== evidenceDigest(row.operationalDetails ?? {}) ||
          groupEntry.placements.length !== units.length || units.some(u => !u.mapped || !groupEntry.placements.some(p =>
            p.unitCode === u.code && p.unitId === u.mapped!.unitId && p.unitExternalId === u.mapped!.externalId))) {
        sourceGroup.reason = 'source_group_facts_changed';
      } else {
        const previous = await db.importedReservationSource.findUnique({ where: {
          externalSystemId_sourceReference: { externalSystemId: system.id, sourceReference: row.ref },
        } });
        if (previous) {
          if (previous.sourceRowDigest === groupEntry.rowDigest) sourceGroup.action = 'unchanged';
          else sourceGroup.reason = 'source_group_changed_requires_review';
        } else {
          sourceGroup.action = 'create';
          for (const placement of groupEntry.placements) {
            const overlapping = blocks.filter(b => b.unitId === placement.unitId && iso(b.startDate) < row.endDate && iso(b.endDate) > row.startDate);
            const occupied = bookings.some(b => b.unitId === placement.unitId && ['confirmed','checked_in','pending_payment'].includes(b.status) &&
              iso(b.startDate) < row.endDate && iso(b.endDate) > row.startDate);
            if (!groupProtectionMatches(overlapping, placement, groupEntry) || occupied) {
              sourceGroup.action = 'skip'; sourceGroup.reason = 'source_group_calendar_conflict';
            }
          }
        }
      }
      if (sourceGroup.reason) applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: sourceGroup.reason });
    }
    const weights = units.map(u => (u.mapped ? arrivalDailySatang(termsByUnit.get(u.mapped.unitId), row.startDate) : 0));
    const totals = (reviewManifest || options.currentOnly) && units.length > 1 ? units.map(() => 0) : splitByWeight(row.revenueSatang, weights);
    const paidShares = (reviewManifest || options.currentOnly) && units.length > 1 ? units.map(() => 0) : splitByWeight(row.amountPaidSatang, weights);
    units.forEach((u, i) => {
      const key = units.length > 1 ? `${row.ref}:${u.code}` : row.ref;
      const bookingId = bookingByKey.get(key) ?? null;
      const existing = bookingId ? bookingById.get(bookingId) ?? null : null;
      const source = parsed.sourcePayments.find(p => p.rowNumber === row.rowNumber)!;
      const stay: PlannedStay = {
        key, ref: row.ref, rowNumber: row.rowNumber, unitCode: u.code,
        unitId: u.mapped?.unitId ?? null, unitExternalId: u.mapped?.externalId ?? null,
        guestName: row.guestName, channel, sourceChannelName,
        startDate: row.startDate, endDate: row.endDate, totalSatang: totals[i],
        sourceReservationTotalSatang: row.revenueSatang,
        paidSatang: paidShares[i], sourcePaymentStatus: source.paymentStatus,
        sourcePaymentAmountRaw: source.amountPaidRaw, alreadyPaidSatang: bookingId ? paidByBooking.get(bookingId) ?? 0 : 0,
        adults: row.adults ?? 0, children: row.children ?? 0,
        partyUnknown: row.adults === null || row.children === null,
        workbookStatus: row.status, occupancyId: null, bookingId,
        completeAfterImport: false, action: 'skip',
      };
      stays.push(stay);
      if (referenceAliases.has(key)) {
        stay.reason = 'source_reference_alias_requires_review';
        applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
      }
      if (sourceGroup) {
        stay.reason = sourceGroup.reason ?? 'source_group_placement';
        return;
      }
      if (options.currentOnly && units.length > 1) {
        stay.reason = 'source_group_allocation_required';
        applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
      }
      if (reviewManifest) {
        stay.adults = row.adults ?? 0;
        stay.children = row.children ?? 0;
        stay.partyUnknown = row.adults === null || row.children === null;
        if (row.status !== 'confirmed') { stay.reason = 'source_status_deferred'; return; }
        if (units.length !== 1) {
          // Booking.totalThb is per villa; the source supplies only a group total.
          // Do not allocate it by current tariffs or copy it to every placement.
          stay.reason = 'source_group_allocation_required';
          applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
        }
        const entry = reviewManifest.entries.find(e => e.ref === row.ref);
        if (!entry) { stay.reason = 'source_review_missing'; return; }
        if (entry.rowDigest !== evidenceDigest({ row, source }) || entry.unitId !== stay.unitId ||
            entry.unitExternalId !== stay.unitExternalId || entry.startDate !== stay.startDate ||
            entry.endDate !== stay.endDate || entry.totalSatang !== stay.totalSatang ||
            entry.guestName !== stay.guestName || entry.channel !== stay.channel ||
            entry.sourceChannelName !== stay.sourceChannelName || entry.adults !== row.adults ||
            entry.children !== row.children || entry.rawStatus !== source.paymentStatus ||
            entry.reportedPaidSatang !== source.amountPaidSatang ||
            evidenceDigest(entry.operationalDetails ?? {}) !== evidenceDigest(row.operationalDetails ?? {})) {
          stay.reason = 'source_review_facts_changed';
          applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
        }
        stay.review = { workbookSha256: reviewManifest.workbookSha256,
          manifestDigest: evidenceDigest(reviewManifest), ref: row.ref, rowDigest: entry.rowDigest };
      }
      if (!u.mapped) { stay.reason = 'unknown_villa'; return; }
      if (options.currentOnly && row.status === 'cancelled' && !existing) { stay.reason = 'cancelled_source_no_booking'; return; }
      const start = new Date(row.startDate + 'T00:00:00Z').getTime();
      const end = new Date(row.endDate + 'T00:00:00Z').getTime();
      const overlaps = <T extends { startDate: Date; endDate: Date; unitId: string }>(x: T) =>
        x.unitId === u.mapped!.unitId && x.startDate.getTime() < end && x.endDate.getTime() > start;

      const unitBlocks = blocks.filter(overlaps);
      const reviewedBlock = reviewManifest?.entries.find(e => e.ref === row.ref)?.block;
      const exactReviewedBlocks = !!stay.review && (reviewedBlock === null
        ? unitBlocks.length === 0
        : !!reviewedBlock && unitBlocks.length === 1 &&
        unitBlocks[0].id === reviewedBlock?.id && unitBlocks[0].externalRef === reviewedBlock.externalRef &&
        unitBlocks[0].reason === reviewedBlock.reason &&
        (reviewedBlock.externalRef !== null || unitBlocks[0].note === reviewedBlock.note) &&
        ((reviewManifest?.version ?? 1) < 2 || (unitBlocks[0].note === reviewedBlock.note &&
          unitBlocks[0].updatedAt.toISOString() === new Date(reviewedBlock.updatedAt!).toISOString())) &&
        iso(unitBlocks[0].startDate) === row.startDate && iso(unitBlocks[0].endDate) === row.endDate);
      if (stay.review && !existing && !exactReviewedBlocks) {
        stay.reason = 'source_review_block_changed';
        applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
      }
      if (unitBlocks.length && !exactReviewedBlocks) {
        stay.reason = 'protection_identity_unverified';
        applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, unitCode: u.code, message: stay.reason });
        return;
      }
      if (!reviewManifest && row.status === 'confirmed' && (row.adults === null || row.children === null)) {
        stay.reason = 'source_party_review_required';
        applyBlockers.push({ rowNumber: row.rowNumber, ref: row.ref, message: stay.reason }); return;
      }
      if (row.status === 'pending') { stay.reason = 'pending_kept_protected'; return; }
      if (row.status === 'unknown') { stay.reason = 'unknown_status'; return; }
      if (existing && stay.review) { stay.action = 'create'; return; }
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
        if (same) stay.action = 'unchanged';
        else if (existing.status === 'confirmed') stay.action = 'change';
        else { stay.action = 'skip'; stay.reason = 'stay_already_' + existing.status; }

        return;
      }
      const otherBookings = bookings.filter(b => overlaps(b) &&
        ['confirmed', 'checked_in', 'pending_payment'].includes(b.status));
      if (row.status === 'cancelled') {
        // History only: a cancelled stay never takes the calendar.
        if (otherBookings.length || unitBlocks.length) { stay.reason = 'cancelled_overlaps_live_stay'; return; }
        stay.action = 'create_cancelled';
        return;
      }
      if (otherBookings.length) { stay.reason = 'calendar_conflict'; return; }
      stay.action = 'create';

    });
  }

  const touched = new Set(stays.filter(s => s.occupancyId).map(s => 'layantara:occupancy:' + s.occupancyId));
  const reviewedBlockIds = new Set(stays.filter(s => s.review && s.action === 'create')
    .flatMap(s => reviewManifest?.entries.filter(e => e.ref === s.ref).flatMap(e => e.block ? [e.block.id] : []) ?? []));
  const untouchedProtections = blocks
    .filter(b => !reviewedBlockIds.has(b.id) && (reviewManifest || b.externalRef?.startsWith('layantara:occupancy:')) && !touched.has(b.externalRef ?? '') &&
      b.endDate.getTime() > now.getTime() - 400 * DAY)
    .map(b => ({ unitCode: codeByUnit.get(b.unitId) ?? '?', startDate: iso(b.startDate), endDate: iso(b.endDate), reason: b.reason }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const summary = { create: 0, create_cancelled: 0, change: 0, cancel: 0, unchanged: 0, skip: 0,
    reservations: scopedRows.length, problems: parsed.problems.length };
  for (const s of stays) summary[s.action] += 1;
  return { sourceGroups, reviewedSource: !!reviewManifest, systemId: system.id, environment: system.environment, today, stays, problems: parsed.problems, applyBlockers, untouchedProtections, summary };
}

// ── applying ────────────────────────────────────────────────────────────────

export class WorkbookReconciliationRequired extends Error {
  constructor(public readonly plan: ImportPlan) {
    super('WORKBOOK_RECONCILIATION_REQUIRED');
    this.name = 'WorkbookReconciliationRequired';
  }
}

export interface AppliedStay { key: string; action: StayAction; status: string; code?: string; bookingId: string | null }

async function ensureIntegrationActor(db: PrismaClient, systemId: string, actorIdentityId: string): Promise<string> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM external_system WHERE id = ${systemId} FOR UPDATE`;
  const system = await tx.externalSystem.findUniqueOrThrow({ where: { id: systemId } });
  const config = (system.config ?? {}) as Record<string, unknown>;
  if (typeof config.integrationActorIdentityId === 'string' && config.integrationActorIdentityId) return config.integrationActorIdentityId;
  // Source-side edits are attributed to a dedicated integration identity,
  // never to the admin who uploaded the file or to the guest.
  const actor = await tx.identity.create({ data: { firstName: 'Layantara', lastName: 'Reservations import' } });
  await tx.externalSystem.update({ where: { id: systemId }, data: { config: { ...config, integrationActorIdentityId: actor.id } } });
  await tx.auditLog.create({ data: {
    actorIdentityId, action: 'layantara.integration_actor_created', entityType: 'ExternalSystem', entityId: systemId,
    data: { integrationActorIdentityId: actor.id },
  } });
  return actor.id;
  });
}

export async function applyWorkbookImport(
  db: PrismaClient,
  plan: ImportPlan,
  input: { actorIdentityId: string; now?: Date },
): Promise<{ applied: AppliedStay[]; groups: number; completed: number; sourceGroupResults: Array<{ ref: string; status: string; sourceId?: string; groupId?: string; code?: string }> }> {
  // Reject the entire batch before creating identities, inbox records or any other writes.
  if (plan.applyBlockers.length) throw new WorkbookReconciliationRequired(plan);
  // Preview is not a lock: recheck inventory immediately before the first write.
  const blocks = await db.blockedDate.findMany({ where: {
    unitId: { in: plan.stays.flatMap(stay => stay.unitId ? [stay.unitId] : []) },
  }, select: { unitId: true, startDate: true, endDate: true } });
  const freshBlockers = plan.stays.filter(stay => !stay.review && (!plan.reviewedSource || !['skip','unchanged'].includes(stay.action)) && blocks.some(block =>
    block.unitId === stay.unitId && iso(block.startDate) < stay.endDate && iso(block.endDate) > stay.startDate))
    .map(stay => ({ rowNumber: stay.rowNumber, ref: stay.ref, unitCode: stay.unitCode,
      message: 'protection_identity_unverified' }));
  if (freshBlockers.length) throw new WorkbookReconciliationRequired({ ...plan, applyBlockers: freshBlockers });
  if (!plan.reviewedSource) await ensureIntegrationActor(db, plan.systemId, input.actorIdentityId);
  const now = input.now ?? new Date();
  const runVersion = Math.floor(now.getTime() / 1000) * 100;
  const applied: AppliedStay[] = [];
  const completed = 0;

  const send = async (stay: PlannedStay, step: number, payload: Omit<ChannelEvent, 'contractVersion' | 'eventId' | 'eventVersion' | 'externalBookingId' | 'externalUnitId' | 'occurredAt'>) => {
    const body = {
      contractVersion: 1 as const, eventVersion: runVersion + step,
      externalBookingId: stay.key, externalUnitId: stay.unitExternalId!, occurredAt: now.toISOString(),
      ...payload,
    };
    // Same row content → same event id and the same payload hash, so a
    // re-run reports a duplicate instead of a collision. The run's version
    // and timestamp are deliberately outside the hashed content.
    const content = JSON.stringify({ ...body, eventVersion: 0, occurredAt: '', ...(stay.review ? { review: stay.review } : {}) });
    const eventId = 'wb-' + createHash('sha256').update(content).digest('hex').slice(0, 40);
    const event = parseChannelEvent({ ...body, eventId }, { reviewedUnknownParty: !!stay.review });
    return applyChannelEvent(db, { event, rawBody: content, environment: plan.environment, operatingRecord: true, workbookReview: stay.review });
  };
  const bookingPayload = (stay: PlannedStay, eventType: 'booking.confirmed' | 'booking.changed') => ({
    eventType, startDate: stay.startDate, endDate: stay.endDate, channel: stay.channel,
    ...(stay.sourceChannelName ? { sourceChannelName: stay.sourceChannelName } : {}),
    guestExternalId: reviewedGuestKey(stay.ref), guestName: stay.guestName,
    adults: stay.adults, children: stay.children, totalSatang: stay.totalSatang, currency: 'THB' as const,
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
    applied.push({ key: stay.key, action: stay.action, status: outcome.status, code: outcome.code, bookingId });
  }

  const sourceGroupResults: Array<{ ref: string; status: string; sourceId?: string; groupId?: string; code?: string }> = [];
  let groups = 0;
  for (const group of plan.sourceGroups ?? []) {
    if (group.action === 'skip') { sourceGroupResults.push({ ref: group.ref, status: 'skip', code: group.reason }); continue; }
    try {
      const result = await applyReviewedImportedGroup(db, { systemId: plan.systemId, environment: plan.environment,
        review: group.review, actorIdentityId: input.actorIdentityId });
      sourceGroupResults.push({ ref: group.ref, ...result });
      if (result.status === 'processed') groups += 1;
    } catch (error) {
      const code = error instanceof Error && /^(IMPORTED_GROUP_|WORKBOOK_GROUP_)/.test(error.message) ? error.message : 'IMPORTED_GROUP_APPLY_FAILED';
      sourceGroupResults.push({ ref: group.ref, status: 'quarantined', code });
    }
  }
  // Ordinary already-priced multi-villa bookings retain their existing path.
  const byRef = new Map<string, string[]>();
  for (const a of applied) {
    const stay = plan.stays.find(s => s.key === a.key)!;
    if (a.bookingId && ['processed', 'duplicate'].includes(a.status) && stay.key !== stay.ref) byRef.set(stay.ref, [...(byRef.get(stay.ref) ?? []), a.bookingId]);
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
  return { applied, groups, completed, sourceGroupResults };
}

