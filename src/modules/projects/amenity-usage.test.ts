import { describe, expect, it } from 'vitest';
import { amenityHoursFromForm, amenityLeadTime, amenityLinesInput, amenityUsageLines, hasSimpleAmenityHours, parseAmenityLines } from './amenity-usage';
const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [key, value] of Object.entries(values)) fd.set(key, value); return fd; };
describe('canonical complex usage facts', () => {
  it('separates 24-hour access from staff contact hours', () => {
    expect(amenityHoursFromForm(form({ hoursOpen24h: 'on', staffHoursOpen: '09:00', staffHoursClose: '18:00', hoursTimezone: 'Asia/Bangkok' }), null)).toEqual({ daily: [['00:00','24:00']], staffContact: [['09:00','18:00']], timezone: 'Asia/Bangkok' });
  });
  it('does not invent unknown hours', () => expect(amenityHoursFromForm(form({ hoursTimezone: 'Asia/Bangkok' }), null)).toBeNull());
  it('keeps unknown extension fields while editing daily hours', () => expect(amenityHoursFromForm(form({ hoursOpen: '08:00', hoursClose: '20:00' }), { exceptions: ['Closed for maintenance'], daily: [['01:00', '02:00']] })).toEqual({ exceptions: ['Closed for maintenance'], daily: [['08:00','20:00']] }));
  it('rejects a partial schedule and invalid timezone', () => {
    expect(() => amenityHoursFromForm(form({ hoursOpen: '08:00' }), null)).toThrow();
    expect(() => amenityHoursFromForm(form({ hoursTimezone: 'Made/Up' }), null)).toThrow();
  });
  it('keeps custom weekly and split schedules in custom mode', () => {
    const weekly = { mon: [['08:00','12:00'],['14:00','20:00']] };
    expect(hasSimpleAmenityHours(weekly)).toBe(false);
    expect(amenityHoursFromForm(form({ hoursMode: 'custom', openingHours: JSON.stringify(weekly) }), weekly)).toEqual(weekly);
    expect(hasSimpleAmenityHours({ daily: [['08:00','20:00']], timezone: 'Asia/Bangkok' })).toBe(true);
    expect(hasSimpleAmenityHours(['Every day 08:00–20:00'])).toBe(false);
  });
  it('rejects malformed JSON rather than saving corrupted rules as text', () => expect(() => parseAmenityLines('{"daily":')).toThrow());
  it('round trips simple rules as editable lines', () => {
    const rules = ['Bring your own yoga mat.', 'Children need guardian supervision.'];
    expect(parseAmenityLines(amenityLinesInput(rules))).toEqual(rules);
  });
  it('renders nested schedules without JSON syntax', () => expect(amenityUsageLines({ daily: [['08:00','20:00']], staffContact: [['09:00','18:00']], timezone: 'Asia/Bangkok' }, { daily: 'Daily access', staffContact: 'Staff contact hours', timezone: 'Time zone' })).toEqual(['Daily access: 08:00–20:00','Staff contact hours: 09:00–18:00','Time zone: Asia/Bangkok']));
  it('shows lead time in days, hours or minutes without inventing a rule', () => {
    expect(amenityLeadTime({ minLeadMinutes: 1440 })).toEqual({ amount: 1, unit: 'days' });
    expect(amenityLeadTime({ minLeadMinutes: 90 })).toEqual({ amount: 90, unit: 'minutes' });
    expect(amenityLeadTime({ minLeadMinutes: 120 })).toEqual({ amount: 2, unit: 'hours' });
    expect(amenityLeadTime(null)).toBeNull(); expect(amenityLeadTime({ minLeadMinutes: -1 })).toBeNull();
  });
});

import { amenityLeadTimeFromForm, singleAmenityHours } from './amenity-usage';
it('imports legacy-readable daily strings without requiring a JSON editor', () => {
  expect(singleAmenityHours('08:00–20:00')).toEqual(['08:00','20:00']);
  expect(hasSimpleAmenityHours({ daily:'00:00–24:00',staffContact:'09:00–18:00',timezone:'Asia/Bangkok' })).toBe(true);
});
it('converts an ordinary one-day notice into the existing minute field', () => {
  expect(amenityLeadTimeFromForm(form({leadTimeAmount:'1',leadTimeUnit:'1440'}))).toBe(1440);
  expect(amenityLeadTimeFromForm(form({leadTimeAmount:'',leadTimeUnit:'1440'}))).toBeUndefined();
  expect(() => amenityLeadTimeFromForm(form({leadTimeAmount:'-1',leadTimeUnit:'1440'}))).toThrow();
});
