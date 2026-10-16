import { describe, expect, it, vi } from 'vitest';
import { createOpportunity } from '@/modules/crm/crm.service';
const input = { identityId: 'author', type: 'management' as const, title: 'Ordinary opportunity', source: 'manual' };
function db() {
  const tx = { crmProfile: { upsert: vi.fn(async () => ({})) }, crmOpportunity: { create: vi.fn(async ({ data }) => ({ id: 'new-opportunity', ...data })) }, crmActivity: { create: vi.fn(async () => ({})) } };
  return { ...tx, identity: { findUnique: vi.fn(async () => ({ id: 'author', status: 'active' })) }, $transaction: vi.fn(async run => run(tx)) } as any;
}
describe('canonical generic CRM writer cannot forge employee creation provenance', () => {
  it.each([null, {}, { version: 1, creatorIdentityId: 'author' }])('rejects a reserved marker before any read or transaction: %j', async employeeCreation => {
    const database = db();
    await expect(createOpportunity(database, { ...input, source: 'myuno_property_submission_v1', requirements: { employeeCreation } })).rejects.toMatchObject({ status: 400 });
    expect(database.identity.findUnique).not.toHaveBeenCalled(); expect(database.$transaction).not.toHaveBeenCalled();
  });
  it('preserves ordinary CRM requirements and downstream activity creation', async () => {
    const database = db();
    const result = await createOpportunity(database, { ...input, requirements: { bedrooms: 2, note: 'Ordinary CRM context' } });
    expect(result.requirements).toEqual({ bedrooms: 2, note: 'Ordinary CRM context' });
    expect(database.crmActivity.create).toHaveBeenCalledTimes(1);
  });
});
