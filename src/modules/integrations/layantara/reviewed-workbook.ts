import { createHash } from 'node:crypto';
import type { ChannelEvent } from './channel-contract';
import { validCalendarDay } from '@/modules/booking/calendar-projection';

/** Private server configuration, never accepted from the upload request. */
export interface ReviewedWorkbookEntry {
  ref: string;
  rowDigest: string;
  unitId: string;
  unitExternalId: string;
  startDate: string;
  endDate: string;
  totalSatang: number;
  guestName: string;
  channel: ChannelEvent['channel'];
  sourceChannelName?: string;
  adults: number | null;
  children: number | null;
  rawStatus: string;
  reportedPaidSatang: number | null;
  block: { id: string; externalRef: string | null; note?: string | null; sourceId: string; reason: 'ota_import' | 'owner_hold' | 'maintenance' | 'other' };
}
export interface ReviewedWorkbookManifest {
  version: 1;
  workbookSha256: string;
  provenance: string;
  entries: ReviewedWorkbookEntry[];
}
export interface WorkbookReviewContext { workbookSha256: string; manifestDigest: string; ref: string; rowDigest: string }
export const evidenceDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
const count = (v: unknown) => v === null || (Number.isSafeInteger(v) && Number(v) >= 0);

export function readReviewedWorkbook(config: unknown, workbookSha256: string): ReviewedWorkbookManifest {
  const m = (config as { reviewedWorkbookImport?: ReviewedWorkbookManifest } | null)?.reviewedWorkbookImport;
  if (!m || m.version !== 1 || !hash(m.workbookSha256) || m.workbookSha256 !== workbookSha256 ||
      !text(m.provenance) || !Array.isArray(m.entries) || !m.entries.length || m.entries.length > 1000)
    throw new Error('WORKBOOK_REVIEW_MANIFEST_REQUIRED');
  const refs = new Set<string>();
  const blockIds = new Set<string>();
  for (const e of m.entries) {
    if (!e || !text(e.ref) || refs.has(e.ref) || !hash(e.rowDigest) || !text(e.unitId) || !text(e.unitExternalId) ||
        !validCalendarDay(e.startDate) || !validCalendarDay(e.endDate) || e.endDate <= e.startDate ||
        !Number.isSafeInteger(e.totalSatang) || e.totalSatang < 0 || !text(e.guestName) ||
        !['airbnb','booking_com','agoda','expedia','trip_com','direct','agent'].includes(e.channel ?? '') ||
        (e.sourceChannelName !== undefined && !text(e.sourceChannelName)) ||
        !count(e.adults) || e.adults === 0 || !count(e.children) || typeof e.rawStatus !== 'string' ||
        !count(e.reportedPaidSatang) || !e.block || !text(e.block.id) || blockIds.has(e.block.id) ||
        !text(e.block.sourceId) || !['ota_import','owner_hold','maintenance','other'].includes(e.block.reason) || (e.block.externalRef === null
          ? e.block.sourceId !== e.ref || !text(e.block.note)
          : e.block.externalRef !== 'layantara:occupancy:' + e.block.sourceId))
      throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
    refs.add(e.ref); blockIds.add(e.block.id);
  }
  return m;
}
export function reviewedEntryForEvent(config: unknown, review: WorkbookReviewContext, e: ChannelEvent): {
  manifest: ReviewedWorkbookManifest; entry: ReviewedWorkbookEntry;
} {
  const manifest = readReviewedWorkbook(config, review.workbookSha256);
  const entry = manifest.entries.find(x => x.ref === review.ref);
  if (evidenceDigest(manifest) !== review.manifestDigest || !entry || entry.rowDigest !== review.rowDigest ||
      e.eventType !== 'booking.confirmed' || e.externalBookingId !== entry.ref || e.externalUnitId !== entry.unitExternalId ||
      e.startDate !== entry.startDate || e.endDate !== entry.endDate || e.totalSatang !== entry.totalSatang ||
      e.guestName !== entry.guestName || e.channel !== entry.channel || e.sourceChannelName !== entry.sourceChannelName ||
      e.adults !== (entry.adults ?? 0) || e.children !== (entry.children ?? 0) ||
      e.guestExternalId !== reviewedGuestKey(review.ref)) throw new Error('WORKBOOK_REVIEW_FACTS_CHANGED');
  return { manifest, entry };
}
/** ExternalMapping already scopes this key by the canonical external system. */
export const reviewedGuestKey = (ref: string) => 'wb-reservation:' + createHash('sha256').update(ref).digest('hex').slice(0, 32);
