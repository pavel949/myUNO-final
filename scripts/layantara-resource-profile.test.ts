import { describe, expect, it } from 'vitest';
import { RESOURCE_FIELDS, sanitizeResourceRow } from './layantara-resource-profile';

describe('Layantara static resource allowlist', () => {
  it('has no forbidden operational table families', () => {
    expect(Object.keys(RESOURCE_FIELDS).some(t =>
      /(reservation|booking_requests|occupanc|payment|refund|ledger|statement|notification|task|pricing_change_log|staff)/.test(t)
    )).toBe(false);
  });

  it('exports physical facts but not source operational metadata', () => {
    expect(sanitizeResourceRow('operational_inventory', {
      id: 'source-1', unit_code: 'G6', bedrooms: 2, public_name: 'Villa G6',
      guest_name: 'do not export', booking_id: 'do not export', notes: 'internal',
    })).toEqual({ id: 'source-1', unit_code: 'G6', bedrooms: 2, public_name: 'Villa G6' });
  });

  it('retains exact pricing configuration and rejects unknown tariff fields', () => {
    expect(sanitizeResourceRow('pricing_discount_rules', {
      id: 'discount-1', discount_percent: 10, stackable: false,
      priority: 2, rate_mode: 'monthly',
    })).toMatchObject({ discount_percent: 10, stackable: false, priority: 2 });
    expect(() => sanitizeResourceRow('pricing_discount_rules', {
      id: 'discount-1', new_calculation_rule: 'not mapped',
    })).toThrow('Unmapped tariff fields');
  });

  it('rejects personal and operational identifiers nested inside allowed tariff JSON', () => {
    expect(() => sanitizeResourceRow('pricing_engine_settings', {
      id: 's1', setting_value: { guest_name: 'sensitive' },
    })).toThrow('Operational data');
    expect(() => sanitizeResourceRow('project_commercial_policies', {
      id: 'p1', policy_data: { payment_id: 'historical' },
    })).toThrow('Operational data');
  });
});
