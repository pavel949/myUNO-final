import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getOwnerDashboard, getOwnerStatements } from './owner.service';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance/statement-signoff.service';

describe('owner dashboard statement query boundaries', () => {
  it('selects latest statement only from this beneficiary and visible statuses', async () => {
    const findMany = vi.fn(async () => []);
    await getOwnerDashboard({ unit: { findMany } } as unknown as PrismaClient, 'owner-a');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerIdentityId: 'owner-a' },
      select: expect.objectContaining({ statements: expect.objectContaining({
        where: { ownerIdentityId: 'owner-a', status: { in: OWNER_VISIBLE_STATEMENT_STATUSES } }, take: 1,
      }) }),
    }));
  });
  it('reads historical approved records without requiring current ownership or live inventory', async () => {
    const findMany = vi.fn(async () => [{ id: 'historical-statement' }]);
    const records = await getOwnerStatements({ ownerStatement: { findMany } } as unknown as PrismaClient, 'owner-a');
    expect(records).toEqual([{ id: 'historical-statement' }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { ownerIdentityId: 'owner-a', status: { in: OWNER_VISIBLE_STATEMENT_STATUSES } }, orderBy: { periodEnd: 'desc' },
    });
  });
});
