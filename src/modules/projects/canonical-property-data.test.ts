import { describe, it, expect, vi } from 'vitest';
import {
  calculatePropertyFactsCompleteness,
  calculateDeveloperCompleteness,
} from './property-facts.service';
import {
  PROJECT_TYPES,
  ORGANIZATION_ROLES,
  PROJECT_FACILITIES,
  BED_TYPES,
  VIEWS,
  OWNERSHIP_TENURES,
  BLOCKING_REASONS,
  getLabel,
} from './taxonomies';

describe('Canonical Property Data Architecture Unit Tests', () => {
  it('Scenario A & B: Developer Completeness & Portfolio Tracking', () => {
    const devOrg = {
      name: 'Paradise Group',
      legalName: 'Paradise Developments Co., Ltd.',
      tradingName: 'Paradise Group',
      website: 'https://paradisegroup.com',
      contactEmail: 'dev@paradisegroup.com',
      registrationNumber: '0105550001112',
      developerTrackRecord: {
        completedProjects: 5,
        activeProjects: 3,
      },
    };

    const score = calculateDeveloperCompleteness(devOrg);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('Scenario C: Property Facts Completeness calculation', () => {
    const project = {
      name: 'Grand Ocean Resort',
      address: '123 Beach Road, Phuket',
      projectType: 'resort',
      latitude: 7.98,
      facilities: ['reception', 'security', 'common_pools'],
      totalUnits: 50,
    };

    const completeness = calculatePropertyFactsCompleteness(project);
    expect(completeness).toBe(100);
  });

  it('Scenario H: Multi-language Taxonomies (EN, TH, RU)', () => {
    expect(getLabel(PROJECT_TYPES, 'resort', 'en')).toBe('Resort');
    expect(getLabel(PROJECT_TYPES, 'resort', 'th')).toBe('รีสอร์ท');
    expect(getLabel(PROJECT_TYPES, 'resort', 'ru')).toBe('Курорт');

    expect(getLabel(ORGANIZATION_ROLES, 'developer', 'en')).toBe('Developer');
    expect(getLabel(ORGANIZATION_ROLES, 'developer', 'th')).toBe('ผู้พัฒนาโครงการ');
    expect(getLabel(ORGANIZATION_ROLES, 'developer', 'ru')).toBe('Застройщик');

    expect(getLabel(PROJECT_FACILITIES, 'reception', 'en')).toBe('Reception / Front Desk');
    expect(getLabel(PROJECT_FACILITIES, 'reception', 'th')).toBe('แผนกต้อนรับ');
    expect(getLabel(PROJECT_FACILITIES, 'reception', 'ru')).toBe('Стойка регистрации');

    expect(getLabel(BED_TYPES, 'king', 'en')).toBe('King Bed');
    expect(getLabel(BED_TYPES, 'king', 'th')).toBe('เตียงคิงไซส์');
    expect(getLabel(BED_TYPES, 'king', 'ru')).toBe('Кровать King Size');

    expect(getLabel(VIEWS, 'sea', 'en')).toBe('Sea / Ocean View');
    expect(getLabel(VIEWS, 'sea', 'th')).toBe('วิวทะเล');
    expect(getLabel(VIEWS, 'sea', 'ru')).toBe('Вид на море');

    expect(getLabel(OWNERSHIP_TENURES, 'freehold', 'en')).toBe('Freehold');
    expect(getLabel(OWNERSHIP_TENURES, 'freehold', 'th')).toBe('ฟรีโฮลด์ (กรรมสิทธิ์สมบูรณ์)');
    expect(getLabel(OWNERSHIP_TENURES, 'freehold', 'ru')).toBe('Фрихолд (Собственность)');
  });

  it('Scenario D, E, F, G: Commercial Eligibility Engine evaluation mock logic', () => {
    const blockingReason = BLOCKING_REASONS['REQUIRED_CREDENTIAL_MISSING'];
    expect(blockingReason.key).toBe('REQUIRED_CREDENTIAL_MISSING');
    expect(getLabel(BLOCKING_REASONS, 'REQUIRED_CREDENTIAL_MISSING', 'en')).toContain(
      'Required regulatory credential'
    );
    expect(getLabel(BLOCKING_REASONS, 'REQUIRED_CREDENTIAL_MISSING', 'th')).toContain(
      'ขาดใบอนุญาตประกอบธุรกิจโรงแรม'
    );
    expect(getLabel(BLOCKING_REASONS, 'REQUIRED_CREDENTIAL_MISSING', 'ru')).toContain(
      'Отсутствует отельная лицензия'
    );
  });
});
