import { describe, expect, it } from 'vitest';
import { resolveProjectServiceOffer } from './project-service-offer';

const row = (overrides: Partial<Parameters<typeof resolveProjectServiceOffer>[0]['rows'][number]> = {}) => ({
  project_id: 'p1',
  enabled: true,
  public: true,
  price_override_thb: 150_000,
  take_rate_pct: 12,
  lead_time_hours: 4,
  terms_version: 2,
  effective_from: null,
  effective_to: null,
  ...overrides,
});

describe('resolveProjectServiceOffer', () => {
  it('treats services without project rows as platform-wide', () => {
    expect(resolveProjectServiceOffer({
      rows: [], projectId: 'p1', basePriceThb: 100_000, baseLeadTimeHours: 2,
    })).toMatchObject({
      available: true, publiclyVisible: true, source: 'global',
      unitPriceThb: 100_000, leadTimeHours: 2,
    });
  });

  it('uses project price, lead time and take rate as one commercial source', () => {
    expect(resolveProjectServiceOffer({
      rows: [row()], projectId: 'p1', basePriceThb: 100_000, baseLeadTimeHours: 2,
    })).toMatchObject({
      available: true, publiclyVisible: true, source: 'project',
      unitPriceThb: 150_000, leadTimeHours: 4, takeRatePct: 12, termsVersion: 2,
    });
  });

  it('does not leak a restricted service into another project', () => {
    expect(resolveProjectServiceOffer({
      rows: [row()], projectId: 'p2', basePriceThb: 100_000, baseLeadTimeHours: 2,
    }).available).toBe(false);
  });

  it('respects private, disabled and effective-window gates', () => {
    const at = new Date('2026-10-01T00:00:00Z');
    expect(resolveProjectServiceOffer({
      rows: [row({ public: false })], projectId: 'p1',
      basePriceThb: 100_000, baseLeadTimeHours: 2, at,
    }).publiclyVisible).toBe(false);
    expect(resolveProjectServiceOffer({
      rows: [row({ enabled: false })], projectId: 'p1',
      basePriceThb: 100_000, baseLeadTimeHours: 2, at,
    }).available).toBe(false);
    expect(resolveProjectServiceOffer({
      rows: [row({ effective_from: new Date('2026-10-02T00:00:00Z') })], projectId: 'p1',
      basePriceThb: 100_000, baseLeadTimeHours: 2, at,
    }).available).toBe(false);
  });
});
