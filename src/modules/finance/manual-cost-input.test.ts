import { describe, expect, it } from 'vitest';
import {
  ManualCostInputError,
  MAX_COST_SATANG,
  manualCostFingerprint,
  normalizeDescription,
  parseManualCostRequest,
} from './manual-cost-input';

const KEY = '0b9d6f5e-8f3a-4c1e-9d55-6a1f2f1f7c11';
// 2026-10-10 17:30 UTC is already 2026-10-11 in Phuket (UTC+7).
const NOW = new Date('2026-10-10T17:30:00.000Z');

const valid = {
  unitId: 'unit-1',
  entryType: 'cleaning_cost',
  amountThb: 125_050,
  occurredOn: '2026-10-09',
  description: 'Deep clean after checkout',
};

function code(body: unknown, key: string | null = KEY, now = NOW): string | undefined {
  try {
    parseManualCostRequest(body, key, now);
    return undefined;
  } catch (error) {
    if (error instanceof ManualCostInputError) return error.code;
    throw error;
  }
}

describe('parseManualCostRequest', () => {
  it('accepts a well-formed request and lower-cases the key', () => {
    const parsed = parseManualCostRequest(valid, KEY.toUpperCase(), NOW);
    expect(parsed).toMatchObject({
      unitId: 'unit-1',
      entryType: 'cleaning_cost',
      amountSatang: 125_050,
      occurredOn: '2026-10-09',
      idempotencyKey: KEY,
    });
  });

  it('requires a UUID Idempotency-Key', () => {
    expect(code(valid, null)).toBe('missing_idempotency_key');
    expect(code(valid, '')).toBe('missing_idempotency_key');
    expect(code(valid, 'not-a-uuid')).toBe('invalid_idempotency_key');
  });

  it.each([
    ['float satang', 1250.5],
    ['zero', 0],
    ['negative', -100],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['numeric string', '1250'],
    ['null', null],
    ['over the 32-bit ceiling', MAX_COST_SATANG + 1],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 2],
  ])('rejects an invalid amount: %s', (_label, amountThb) => {
    expect(code({ ...valid, amountThb })).toBe('invalid_amount');
  });

  it('accepts the 32-bit ceiling exactly', () => {
    expect(code({ ...valid, amountThb: MAX_COST_SATANG })).toBeUndefined();
  });

  it('does not accept adjustment or any non-cost type as a cost', () => {
    for (const entryType of ['adjustment', 'rental_revenue', 'payout_owner', 'refund_out', '', undefined]) {
      expect(code({ ...valid, entryType })).toBe('invalid_entry_type');
    }
  });

  it('refuses a receiptMediaId rather than silently dropping it', () => {
    expect(code({ ...valid, receiptMediaId: 'media-1' })).toBe('receipt_media_not_supported');
    expect(code({ ...valid, receiptMediaId: null })).toBeUndefined();
  });

  it('does not read who is writing or where the money lands from the body', () => {
    const parsed = parseManualCostRequest(
      { ...valid, projectId: 'other', recordedByIdentityId: 'someone-else', createdByIdentityId: 'x' },
      KEY,
      NOW
    );
    expect(Object.keys(parsed).sort()).toEqual(
      ['amountSatang', 'description', 'entryType', 'idempotencyKey', 'occurredOn', 'unitId'].sort()
    );
  });

  it.each(['2026-02-30', '2026-13-01', '10/10/2026', '2026-10-9', '2026-10-09T00:00:00Z', '', 20261009, null])(
    'rejects a malformed date: %s',
    (occurredOn) => {
      expect(code({ ...valid, occurredOn })).toBe('invalid_date');
    }
  );

  it('rejects dates before the sanity floor', () => {
    expect(code({ ...valid, occurredOn: '2019-12-31' })).toBe('invalid_date');
  });

  it('judges "future" by the Phuket day, not the UTC date', () => {
    // 17:30 UTC on the 10th: Phuket is already on the 11th.
    expect(code({ ...valid, occurredOn: '2026-10-11' })).toBeUndefined();
    expect(code({ ...valid, occurredOn: '2026-10-12' })).toBe('date_in_future');
    // 16:59 UTC: Phuket is still on the 10th, so the 11th is the future.
    const before = new Date('2026-10-10T16:59:59.000Z');
    expect(code({ ...valid, occurredOn: '2026-10-10' }, KEY, before)).toBeUndefined();
    expect(code({ ...valid, occurredOn: '2026-10-11' }, KEY, before)).toBe('date_in_future');
  });

  it('bounds and normalises the description', () => {
    expect(code({ ...valid, description: 'ab' })).toBe('invalid_description');
    expect(code({ ...valid, description: '   ' })).toBe('invalid_description');
    expect(code({ ...valid, description: 'x'.repeat(501) })).toBe('invalid_description');
    expect(code({ ...valid, description: 'bad\u0000char' })).toBe('invalid_description');
    expect(code({ ...valid, description: 42 })).toBe('invalid_description');
    expect(parseManualCostRequest({ ...valid, description: '  Pool   pump\n repair ' }, KEY, NOW).description).toBe(
      'Pool pump repair'
    );
  });

  it('rejects non-object bodies', () => {
    for (const body of [null, 'x', 5, [], undefined]) expect(code(body)).toBe('invalid_body');
  });
});

describe('manualCostFingerprint', () => {
  const base = { unitId: 'u', entryType: 'cleaning_cost' as const, amountSatang: 5000, occurredOn: '2026-10-09', description: 'Deep clean' };

  it('is stable across whitespace and unicode-composition differences', () => {
    expect(manualCostFingerprint({ ...base, description: ' Deep   clean ' })).toBe(manualCostFingerprint(base));
    expect(normalizeDescription('é')).toBe('é');
    expect(manualCostFingerprint({ ...base, description: 'café' })).toBe(
      manualCostFingerprint({ ...base, description: 'café' })
    );
  });

  it.each([
    ['unit', { unitId: 'u2' }],
    ['type', { entryType: 'maintenance_cost' as const }],
    ['amount', { amountSatang: 5001 }],
    ['date', { occurredOn: '2026-10-08' }],
    ['description', { description: 'Deep cleaning' }],
  ])('changes when the %s changes', (_what, patch) => {
    expect(manualCostFingerprint({ ...base, ...patch })).not.toBe(manualCostFingerprint(base));
  });
});
