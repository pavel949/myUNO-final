import { describe, expect, it } from 'vitest';
import { bookingHomeSpaceHref, staySearchParams, stayServiceParams } from './guest-journey';

describe('guest journey context contract', () => {
  it('keeps the project from Project Space through search and unit selection', () => {
    const query = staySearchParams({
      startDate: '2026-12-12',
      endDate: '2026-12-18',
      adults: 2,
      children: 1,
      projectId: 'layantara',
    });
    expect(query.get('projectId')).toBe('layantara');
    expect(query.get('startDate')).toBe('2026-12-12');
    expect(query.get('endDate')).toBe('2026-12-18');
    expect(query.get('adults')).toBe('2');
    expect(query.get('children')).toBe('1');
  });

  it('carries booking/project/unit into myUNO services during a stay', () => {
    const query = stayServiceParams({
      bookingId: 'booking-a10',
      projectId: 'layantara',
      unitId: 'villa-a10',
      category: 'transfer',
    });
    expect(query.toString()).toContain('bookingId=booking-a10');
    expect(query.toString()).toContain('projectId=layantara');
    expect(query.toString()).toContain('unitId=villa-a10');
    expect(query.toString()).toContain('category=transfer');
  });

  it('lands a confirmed booking in its own Home Space', () => {
    expect(bookingHomeSpaceHref('abc/123')).toBe('/bookings/abc%2F123/home-space');
  });
});
