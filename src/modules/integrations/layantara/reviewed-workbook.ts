import { createHash } from 'node:crypto';
import type { ChannelEvent } from './channel-contract';
import { validCalendarDay } from '@/modules/booking/calendar-projection';

/** Source evidence only; never promotes contact/payment labels to verified facts. */
export type SourceOperationalDetails = Partial<Record<
  'sourceReferenceRaw' | 'contact' | 'notes' | 'rateType' | 'breakfast' | 'dietary' | 'servicesIncluded' | 'servicesExcluded', string>>;
export function validOperationalDetails(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([key, text]) =>
      ['sourceReferenceRaw','contact','notes','rateType','breakfast','dietary','servicesIncluded','servicesExcluded'].includes(key) &&
      typeof text === 'string' && text.length <= 4000);
}

export type ReviewedWorkbookGroupEntry = Omit<ReviewedWorkbookEntry, 'unitId' | 'unitExternalId' | 'block'> & {
  placements: Array<{ unitCode: string; unitId: string; unitExternalId: string; block: ReviewedWorkbookEntry['block'] }>;
};

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
  operationalDetails?: SourceOperationalDetails;
  /** Null is an explicit reviewed assertion that no protection is being consumed. */
  block: null | { id: string; externalRef: string | null; note?: string | null; sourceId: string; reason: 'ota_import' | 'owner_hold' | 'maintenance' | 'other'; updatedAt?: string };
}
export interface ReviewedWorkbookManifest {
  version: 1 | 2 | 3;
  sourceSnapshot?: { spreadsheetId: string; modifiedAt: string; capturedAt: string; timezone: 'Asia/Bangkok' };
  workbookSha256: string;
  provenance: string;
  entries: ReviewedWorkbookEntry[];
  groups?: ReviewedWorkbookGroupEntry[];
}
export interface WorkbookReviewContext { workbookSha256: string; manifestDigest: string; ref: string; rowDigest: string }
export const evidenceDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
const count = (v: unknown) => v === null || (Number.isSafeInteger(v) && Number(v) >= 0);

export function readReviewedWorkbook(config: unknown, workbookSha256: string): ReviewedWorkbookManifest {
  const m = (config as { reviewedWorkbookImport?: ReviewedWorkbookManifest } | null)?.reviewedWorkbookImport;
  if (!m || ![1, 2, 3].includes(m.version) || !hash(m.workbookSha256) || m.workbookSha256 !== workbookSha256 ||
      !text(m.provenance) || !Array.isArray(m.entries) || (!m.entries.length && !(m.version === 3 && m.groups?.length)) || m.entries.length > 1000)
    throw new Error('WORKBOOK_REVIEW_MANIFEST_REQUIRED');
  if (m.version >= 2 && (!m.sourceSnapshot || !text(m.sourceSnapshot.spreadsheetId) ||
      m.sourceSnapshot.timezone !== 'Asia/Bangkok' ||
      !Number.isFinite(Date.parse(m.sourceSnapshot.modifiedAt)) || !Number.isFinite(Date.parse(m.sourceSnapshot.capturedAt))))
    throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
  const refs = new Set<string>();
  const blockIds = new Set<string>();
  for (const e of m.entries) {
    if (!e || !text(e.ref) || refs.has(e.ref) || !hash(e.rowDigest) || !text(e.unitId) || !text(e.unitExternalId) ||
        !validCalendarDay(e.startDate) || !validCalendarDay(e.endDate) || e.endDate <= e.startDate ||
        !Number.isSafeInteger(e.totalSatang) || e.totalSatang < 0 || !text(e.guestName) ||
        !['airbnb','booking_com','agoda','expedia','trip_com','direct','agent'].includes(e.channel ?? '') ||
        (e.sourceChannelName !== undefined && !text(e.sourceChannelName)) ||
        !count(e.adults) || e.adults === 0 || !count(e.children) || typeof e.rawStatus !== 'string' ||
        !count(e.reportedPaidSatang) ||
        (e.operationalDetails !== undefined && !validOperationalDetails(e.operationalDetails)) ||
        (e.block !== null && (!e.block || !text(e.block.id) || blockIds.has(e.block.id) ||
          !text(e.block.sourceId) || !['ota_import','owner_hold','maintenance','other'].includes(e.block.reason) || (e.block.externalRef === null
            ? e.block.sourceId !== e.ref || !text(e.block.note)
            : e.block.externalRef !== 'layantara:occupancy:' + e.block.sourceId))))
      throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
    if (m.version >= 2 && e.block &&
        (typeof e.block.note !== 'string' && e.block.note !== null ||
         !e.block.updatedAt || !Number.isFinite(Date.parse(e.block.updatedAt))))
      throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
    refs.add(e.ref); if (e.block) blockIds.add(e.block.id);
  }
  if (m.groups !== undefined) {
    if (m.version !== 3 || !Array.isArray(m.groups) || m.groups.length > 1000)
      throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
    for (const group of m.groups) {
      if (!group || refs.has(group.ref) || !Array.isArray(group.placements) || group.placements.length < 2 || group.placements.length > 39)
        throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
      refs.add(group.ref);
      const units = new Set<string>();
      const codes = new Set<string>();
      for (const placement of group.placements) {
        if (!text(placement.unitCode) || codes.has(placement.unitCode) || units.has(placement.unitId) || (placement.block && blockIds.has(placement.block.id)))
          throw new Error('WORKBOOK_REVIEW_MANIFEST_INVALID');
        const facts = { ...group };
        readReviewedWorkbook({ reviewedWorkbookImport: { version: 2, workbookSha256: m.workbookSha256,
          provenance: m.provenance, sourceSnapshot: m.sourceSnapshot,
          entries: [{ ...facts, ...placement }] } }, workbookSha256);
        units.add(placement.unitId); codes.add(placement.unitCode); if (placement.block) blockIds.add(placement.block.id);
      }
    }
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

/** Server review is reloaded inside the canonical group transaction. */
export function reviewedGroupForContext(config: unknown, context: WorkbookReviewContext) {
  const manifest = readReviewedWorkbook(config, context.workbookSha256);
  const entry = manifest.groups?.find(group => group.ref === context.ref);
  if (manifest.version !== 3 || evidenceDigest(manifest) !== context.manifestDigest || !entry || entry.rowDigest !== context.rowDigest)
    throw new Error('WORKBOOK_GROUP_REVIEW_CHANGED');
  return { manifest, entry };
}
