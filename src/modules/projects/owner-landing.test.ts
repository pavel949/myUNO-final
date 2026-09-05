import { describe, it, expect } from 'vitest';
import { resolveOwnerPortalPath, singleOwnerUnitId } from './owner-landing';

/** T-033 · doc 06 S7 — single-unit owners skip the portfolio shell. */
describe('owner portal entry path', () => {
  it('sends a single-unit owner straight to their unit dashboard', () => {
    expect(resolveOwnerPortalPath({ isPortfolio: false }, [{ id: 'u-1' }])).toBe(
      '/owner/units/u-1'
    );
  });

  it('keeps portfolio owners on the combined home', () => {
    expect(
      resolveOwnerPortalPath({ isPortfolio: true }, [
        { id: 'u-1' },
        { id: 'u-2' },
      ])
    ).toBe('/owner');
  });

  it('falls back to /owner when shape and unit list disagree', () => {
    expect(resolveOwnerPortalPath({ isPortfolio: false }, [])).toBe('/owner');
    expect(
      resolveOwnerPortalPath({ isPortfolio: false }, [{ id: 'u-1' }, { id: 'u-2' }])
    ).toBe('/owner');
  });

  it('exposes the unit id for adaptive /app landing', () => {
    expect(singleOwnerUnitId({ isPortfolio: false }, [{ id: 'u-1' }])).toBe('u-1');
    expect(singleOwnerUnitId({ isPortfolio: true }, [{ id: 'u-1' }])).toBeNull();
  });
});
