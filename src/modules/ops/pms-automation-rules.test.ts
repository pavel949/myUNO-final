import { describe, expect, it } from 'vitest';
import { suggestPmsActions } from './pms-automation-rules';

describe('PMS automation decisions (side-effect free)', () => {
  it('does not notify on expired or malformed payment deadlines', () => {
    expect(suggestPmsActions({type:'booking.pending_payment',bookingId:'b1',expiresAt:'2026-10-01',now:'2026-10-17'})).toEqual([]);
    expect(suggestPmsActions({type:'booking.pending_payment',bookingId:'b1',expiresAt:'bad',now:'2026-10-17'})).toEqual([]);
  });
  it('produces a deterministic idempotency key for active pending payments', () => {
    const event = {type:'booking.pending_payment' as const,bookingId:'b1',expiresAt:'2026-10-18T00:00:00Z',now:'2026-10-17T00:00:00Z'};
    expect(suggestPmsActions(event)).toEqual(suggestPmsActions(event));
    expect(suggestPmsActions(event)[0].key).toBe('payment:b1:2026-10-18T00:00:00Z');
  });
  it('suggests turnover without marking the unit clean', () => {
    expect(suggestPmsActions({type:'stay.checked_out',bookingId:'b2',unitId:'u1'})[0]).toMatchObject({kind:'create_turnover_task',subjectId:'u1'});
  });
  it('alerts on blockers and unknown readiness but not ready units', () => {
    expect(suggestPmsActions({type:'stay.arrival_soon',bookingId:'b3',unitId:'u1',readiness:'ready'})).toEqual([]);
    expect(suggestPmsActions({type:'stay.arrival_soon',bookingId:'b3',unitId:'u1',readiness:'unknown'})[0].kind).toBe('alert_arrival_blocker');
    expect(suggestPmsActions({type:'maintenance.blocked',taskId:'t1',unitId:'u1'})[0].kind).toBe('alert_maintenance');
  });
});
