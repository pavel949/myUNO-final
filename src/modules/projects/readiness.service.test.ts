import { describe, expect, it } from 'vitest';
import { evaluateProjectReadiness, type ProjectReadinessFacts } from './readiness.service';

const readyFacts: ProjectReadinessFacts = {
  hasArea: true,
  hasCoordinates: true,
  hasAddress: true,
  hasCover: true,
  galleryCount: 4,
  unitCount: 2,
  publishableUnitCount: 2,
  pricedUnitCount: 2,
  ratePlanCount: 0,
  complianceCredentialCount: 1,
  activeRoleAssignmentCount: 1,
  activeServiceCount: 2,
};

describe('project go-live readiness', () => {
  it('is ready when every hard requirement is present', () => {
    const report = evaluateProjectReadiness(readyFacts);
    expect(report.ready).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.score).toBe(100);
  });

  it('returns all blockers at once instead of failing one field at a time', () => {
    const report = evaluateProjectReadiness({
      ...readyFacts,
      hasArea: false,
      hasCover: false,
      publishableUnitCount: 0,
      pricedUnitCount: 0,
      complianceCredentialCount: 0,
      activeRoleAssignmentCount: 0,
    });

    expect(report.ready).toBe(false);
    expect(report.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        'project.area_missing',
        'project.cover_missing',
        'inventory.no_publishable_units',
        'pricing.no_sellable_price',
        'compliance.no_credentials',
        'team.no_operator',
      ])
    );
  });

  it('does not let a rate plan substitute for the current runtime pricing authority', () => {
    const report = evaluateProjectReadiness({
      ...readyFacts,
      pricedUnitCount: 0,
      ratePlanCount: 1,
    });

    expect(report.ready).toBe(false);
    expect(report.blockers.map((b) => b.code)).toContain('pricing.no_sellable_price');
    expect(report.warnings.map((w) => w.code)).toContain('pricing.deferred_rate_plan_present');
  });

  it('treats thin gallery, deferred rate-plan data and no services as warnings only when current pricing exists', () => {
    const report = evaluateProjectReadiness({
      ...readyFacts,
      galleryCount: 1,
      ratePlanCount: 1,
      activeServiceCount: 0,
    });

    expect(report.ready).toBe(true);
    expect(report.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        'project.gallery_thin',
        'pricing.deferred_rate_plan_present',
        'services.none_enabled',
      ])
    );
  });
});
