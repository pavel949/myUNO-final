import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { channelPayloadHash, parseChannelEvent, verifyChannelSignature } from './channel-contract';

const event={
  contractVersion:1, eventId:'source:123', eventVersion:2,
  eventType:'booking.confirmed',externalBookingId:'reservation-1',
  externalUnitId:'villa-G6',occurredAt:'2026-10-01T10:00:00.000Z',
  startDate:'2026-10-20',endDate:'2026-10-22',
  channel:'airbnb',guestExternalId:'guest-1',guestName:'Sample Guest',
  adults:2,children:0,totalSatang:2490000,currency:'THB',
};
describe('signed channel-event contract',()=>{
  it('accepts an exact OTA booking with source amount in satang',()=>{
    expect(parseChannelEvent(event)).toMatchObject({eventType:'booking.confirmed',totalSatang:2490000});
  });
  it('rejects dates, unknown money denomination and arbitrary channels',()=>{
    expect(()=>parseChannelEvent({...event,startDate:'2026-02-30'})).toThrow('invalid_stay_dates');
    expect(()=>parseChannelEvent({...event,currency:'USD'})).toThrow('invalid_booking_contract');
    expect(()=>parseChannelEvent({...event,channel:'manual'})).toThrow('invalid_booking_contract');
    expect(()=>parseChannelEvent({...event,eventVersion:0})).toThrow('invalid_event_version');
  });
  it('does not manufacture a payment from an OTA booking',()=>{
    expect(()=>parseChannelEvent({
      ...event,eventType:'payment.received',externalPaymentId:'p1',paymentSatang:1000,
      receiptRef:'receipt-1',settlement:'collected_by_ota',
    })).toThrow('missing_verified_payment_evidence');
  });
  it('requires authentic HMAC over raw bytes and a fresh timestamp',()=>{
    const secret='a-32-byte-at-least-secret-only-on-server';
    const body=JSON.stringify(event), timestamp='1790848800';
    const now=Number(timestamp)*1000;
    const sig=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
    expect(verifyChannelSignature(body,timestamp,sig,secret,now)).toBe(true);
    expect(verifyChannelSignature(body+' ',timestamp,sig,secret,now)).toBe(false);
    expect(verifyChannelSignature(body,timestamp,sig,secret,now+300001)).toBe(false);
    expect(verifyChannelSignature(body,timestamp,sig,'short',now)).toBe(false);
    expect(channelPayloadHash(body)).toMatch(/^[a-f0-9]{64}$/);
  });
});
