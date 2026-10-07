import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { saveTariffDraft, type TariffDraft } from './tariff-editor';

const draft = (steps: TariffDraft['daily'][number]['cancellationSteps']): TariffDraft => ({
  includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 600000, minimumNights: 3, cancellationSteps: steps }],
  monthly: [], yearly: null,
});
function database() {
  const update = vi.fn().mockResolvedValue({});
  const tx = {
    unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit' }) },
    commercialOffering: {
      findMany: vi.fn().mockResolvedValue([{ id: 'offer', offeringType: 'short_term_stay', pricingTerms: {},
        rulesAndPolicies: { bookingPolicies: [{ id: 'policy', rate_mode: 'daily', season_code: 'ALL',
          min_nights: 1, cancellation_summary: 'Standard terms', cancellation_steps: [{ days: 30, pct: 100 }] }] } }]),
      update,
    }, auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = { $transaction: async (run: (client: typeof tx) => Promise<void>) => run(tx) } as unknown as PrismaClient;
  return { db, update };
}
describe('tariff policy reset writer', () => {
  it('removes the refund override only for an explicit standard-policy reset, preserving other terms', async () => {
    const { db, update } = database();
    await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', draft: draft(null) });
    const policy = update.mock.calls[0][0].data.rulesAndPolicies.bookingPolicies[0];
    expect(policy).not.toHaveProperty('cancellation_steps');
    expect(policy).toMatchObject({ id: 'policy', cancellation_summary: 'Standard terms', min_nights: 3 });
  });
  it('preserves existing refund terms when the field is omitted', async () => {
    const { db, update } = database();
    await saveTariffDraft(db, { unitIds: ['unit'], actorIdentityId: 'actor', draft: draft(undefined) });
    expect(update.mock.calls[0][0].data.rulesAndPolicies.bookingPolicies[0].cancellation_steps)
      .toEqual([{ days: 30, pct: 100 }]);
  });
});
