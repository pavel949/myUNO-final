import { describe, it, expect } from 'vitest';
import { assessCheckIn, type CheckInCandidate } from './booking.service';

const stay = (overrides: Partial<CheckInCandidate> = {}): CheckInCandidate => ({
  status: 'confirmed',
  startDate: new Date('2026-11-10T00:00:00.000Z'),
  endDate: new Date('2026-11-14T00:00:00.000Z'),
  adults: 2,
  children: 0,
  infants: 0,
  guests: [
    { nationality: 'RU', passportNumber: 'enc:1' },
    { nationality: 'TH', passportNumber: '' },
  ],
  ...overrides,
});

describe('assessCheckIn — the TM30-safe check-in rule', () => {
  it('allows a confirmed, fully registered party on the arrival day', () => {
    expect(assessCheckIn(stay(), '2026-11-10')).toBeNull();
  });

  it('allows a late arrival on a later night of the stay', () => {
    expect(assessCheckIn(stay(), '2026-11-13')).toBeNull();
  });

  it('refuses a check-in weeks before arrival (the audit reproduction: 1 Oct for 10 Nov)', () => {
    expect(assessCheckIn(stay(), '2026-10-01')).toBe('before_arrival');
  });

  it('refuses on or after the departure day', () => {
    expect(assessCheckIn(stay(), '2026-11-14')).toBe('after_departure');
  });

  it('refuses a booking that is not confirmed', () => {
    expect(assessCheckIn(stay({ status: 'pending_payment' }), '2026-11-10')).toBe('not_confirmed');
  });

  it('refuses when nobody is registered — no TM30 filing could ever be created', () => {
    expect(assessCheckIn(stay({ guests: [] }), '2026-11-10')).toBe('guests_incomplete');
  });

  it('counts children and infants: every foreigner in the party is reportable', () => {
    expect(assessCheckIn(stay({ children: 1, infants: 1 }), '2026-11-10')).toBe('guests_incomplete');
  });

  it('refuses a foreign guest without a passport number', () => {
    expect(
      assessCheckIn(
        stay({ guests: [{ nationality: 'RU', passportNumber: '' }, { nationality: 'TH', passportNumber: null }] }),
        '2026-11-10',
      ),
    ).toBe('passport_missing');
  });

  it('does not require a passport from Thai nationals', () => {
    expect(
      assessCheckIn(
        stay({ guests: [{ nationality: 'th', passportNumber: null }, { nationality: 'TH', passportNumber: null }] }),
        '2026-11-10',
      ),
    ).toBeNull();
  });

  it('does not count a guest row without a nationality as registered', () => {
    expect(
      assessCheckIn(
        stay({ guests: [{ nationality: 'RU', passportNumber: 'enc:1' }, { nationality: ' ', passportNumber: 'enc:2' }] }),
        '2026-11-10',
      ),
    ).toBe('guests_incomplete');
  });
});
