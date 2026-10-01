import { afterEach, describe, expect, it } from 'vitest';
import {
  createCategoryStayQuoteToken,
  verifyCategoryStayQuoteToken,
} from './category-quote';

describe('category stay quote token', () => {
  const originalSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it('binds accepted money and stay context and expires', () => {
    process.env.SESSION_SECRET = 'test-category-quote-secret-with-sufficient-entropy';
    const { token } = createCategoryStayQuoteToken(
      {
        inventoryCategoryId: 'category-1',
        projectId: 'project-1',
        startDate: '2026-11-10',
        endDate: '2026-11-14',
        adultsCount: 2,
        childrenCount: 1,
        petsCount: 0,
        acceptedTotalSatang: 123_456,
        quotedUnitId: 'unit-1',
      },
      60_000
    );

    expect(verifyCategoryStayQuoteToken(token)).toMatchObject({
      inventoryCategoryId: 'category-1',
      projectId: 'project-1',
      acceptedTotalSatang: 123_456,
      quotedUnitId: 'unit-1',
    });

    const tampered = token.replace('123456', '999999');
    expect(verifyCategoryStayQuoteToken(tampered)).toBeNull();

    const { token: expired } = createCategoryStayQuoteToken(
      {
        inventoryCategoryId: 'category-1',
        projectId: 'project-1',
        startDate: '2026-11-10',
        endDate: '2026-11-14',
        adultsCount: 2,
        childrenCount: 1,
        petsCount: 0,
        acceptedTotalSatang: 123_456,
        quotedUnitId: 'unit-1',
      },
      -1
    );
    expect(verifyCategoryStayQuoteToken(expired)).toBeNull();
  });
});
