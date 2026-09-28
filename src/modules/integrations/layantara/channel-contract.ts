import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { validCalendarDay } from '@/modules/booking/calendar-projection';

/**
 * Incoming messages are instructions from a trusted channel adapter, not
 * arbitrary guest requests. The shared secret remains server-side; guest
 * and agent checkout continue to use their canonical authenticated routes.
 */
export type ChannelEventKind =
  | 'occupancy.protect' | 'occupancy.release' | 'booking.confirmed' | 'booking.changed'
  | 'booking.cancelled' | 'payment.received';

export interface ChannelEvent {
  contractVersion: 1;
  eventId: string;
  eventVersion: number;
  eventType: ChannelEventKind;
  externalBookingId: string;
  externalUnitId: string;
  occurredAt: string;
  occupancyId?: string;
  blockReason?: 'ota_import' | 'owner_hold' | 'maintenance' | 'other';
  startDate?: string;
  endDate?: string;
  channel?: 'airbnb' | 'booking_com' | 'agoda';
  guestExternalId?: string;
  guestName?: string;
  adults?: number;
  children?: number;
  totalSatang?: number;
  currency?: 'THB';
  externalPaymentId?: string;
  paymentSatang?: number;
  receiptRef?: string;
  // Signed proof of funds actually received by operator. An OTA confirmation
  // or OTA-collected guest payment is NOT proof of operator cash collection.
  settlement?: 'received_by_operator';
  note?: string;
}

const identifiers = /^[a-zA-Z0-9_:\-./]{1,180}$/;
const supported = new Set<ChannelEventKind>([
  'occupancy.protect','occupancy.release','booking.confirmed','booking.changed',
  'booking.cancelled','payment.received',
]);
const channels = new Set(['airbnb','booking_com','agoda']);
const hasId = (value: unknown): value is string =>
  typeof value==='string' && identifiers.test(value);
const positiveInteger = (value: unknown): value is number =>
  typeof value==='number' && Number.isSafeInteger(value) && value>0;

export function parseChannelEvent(payload: unknown): ChannelEvent {
  if (!payload || typeof payload!=='object' || Array.isArray(payload)) throw new Error('invalid_payload');
  const e=payload as Record<string,unknown>;
  if (e.contractVersion!==1 || !supported.has(e.eventType as ChannelEventKind)) throw new Error('unsupported_event_type');
  if (!hasId(e.eventId) || !hasId(e.externalBookingId) || !hasId(e.externalUnitId)) throw new Error('invalid_external_identity');
  if (!positiveInteger(e.eventVersion)) throw new Error('invalid_event_version');
  if (typeof e.occurredAt!=='string' || !Number.isFinite(Date.parse(e.occurredAt)) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(e.occurredAt)) throw new Error('invalid_event_date');
  if (e.occupancyId!==undefined && !hasId(e.occupancyId)) throw new Error('invalid_occupancy_id');
  if ((e.eventType==='occupancy.protect' || e.eventType==='occupancy.release') &&
      !hasId(e.occupancyId)) throw new Error('invalid_occupancy_id');
  if (e.eventType==='occupancy.protect' && e.blockReason!==undefined &&
      !['ota_import','owner_hold','maintenance','other'].includes(e.blockReason as string))
    throw new Error('invalid_block_reason');
  const needsDates = e.eventType==='occupancy.protect' || e.eventType==='booking.confirmed' || e.eventType==='booking.changed';
  if (needsDates && (!(typeof e.startDate==='string' && validCalendarDay(e.startDate)) ||
       !(typeof e.endDate==='string' && validCalendarDay(e.endDate)) ||
       (e.endDate as string)<=(e.startDate as string))) throw new Error('invalid_stay_dates');
  if (e.eventType==='booking.confirmed' || e.eventType==='booking.changed') {
    if (!channels.has(e.channel as string) || !hasId(e.guestExternalId) ||
        typeof e.guestName!=='string' || e.guestName.trim().length<2 ||
        e.guestName.length>180 || !Number.isInteger(e.adults) || (e.adults as number)<1 ||
        !Number.isInteger(e.children) || (e.children as number)<0 ||
        !Number.isSafeInteger(e.totalSatang) || (e.totalSatang as number)<0 ||
        e.currency!=='THB') throw new Error('invalid_booking_contract');
  }
  if (e.eventType==='payment.received') {
    if (!hasId(e.externalPaymentId) || !positiveInteger(e.paymentSatang) ||
        !hasId(e.receiptRef) || e.settlement!=='received_by_operator') {
      throw new Error('missing_verified_payment_evidence');
    }
  }
  return e as unknown as ChannelEvent;
}

/** timestamp in seconds; signature is lowercase hex HMAC SHA-256. */
export function verifyChannelSignature(
  raw: string, timestamp: string|null, signature: string|null, secret: string,
  nowMs: number=Date.now(),
): boolean {
  if (!secret || secret.length<32 || !timestamp || !signature ||
      !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const sent=Number(timestamp)*1000;
  if (Math.abs(nowMs-sent)>300_000) return false;
  const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest();
  const received=Buffer.from(signature,'hex');
  return received.length===expected.length && timingSafeEqual(expected,received);
}

export function channelPayloadHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
