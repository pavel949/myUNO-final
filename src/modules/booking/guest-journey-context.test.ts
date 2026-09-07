import { describe, it, expect } from 'vitest';

describe('Guest Journey Flow Helper Logic', () => {
  it('preserves search parameters across search to unit detail link generation', () => {
    const startDate = '2026-11-01';
    const endDate = '2026-11-07';
    const adults = '2';
    const children = '1';
    const unitId = 'unit-123';

    const unitHref = `/units/${unitId}?startDate=${startDate}&endDate=${endDate}&adults=${adults}&children=${children}`;

    expect(unitHref).toContain(`startDate=${startDate}`);
    expect(unitHref).toContain(`endDate=${endDate}`);
    expect(unitHref).toContain(`adults=${adults}`);
    expect(unitHref).toContain(`children=${children}`);
  });

  it('preserves next redirect parameter for unauthenticated booking review flow', () => {
    const reviewPath = '/book/review?unitId=unit-123&startDate=2026-11-01&endDate=2026-11-07';
    const loginUrl = `/login?next=${encodeURIComponent(reviewPath)}`;

    expect(loginUrl).toContain('next=%2Fbook%2Freview');
    expect(loginUrl).toContain('unitId%3Dunit-123');
  });
});
