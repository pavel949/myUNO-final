import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { stageProtection } from './protection.service';
import type { ReconciliationDecision } from './adapter';
const decision: ReconciliationDecision = {
  action:'protect',id:'source-1',unitId:'target-1',startDate:'2026-10-01',
  endDate:'2026-10-04',blockReason:'ota_import',externalRef:'layantara:occupancy:source-1',
};
describe('staged protection service', () => {
  it('does not write without explicit opt-in', async () => {
    const db = { $transaction: vi.fn() } as unknown as PrismaClient;
    expect(await stageProtection(db,{decision,mappingVerified:true})).toEqual({status:'planned',blockId:null});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects unverified physical identity and nonprotective decisions', async () => {
    const db = { $transaction: vi.fn() } as unknown as PrismaClient;
    await expect(stageProtection(db,{decision,mappingVerified:false,allowWrite:true})).rejects.toThrow('crosswalk');
    await expect(stageProtection(db,{decision:{action:'archive',id:'x',reason:'released'},mappingVerified:true,allowWrite:true}))
      .rejects.toThrow('protective');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('replays the same protection idempotently under the unit lock', async () => {
    const tx = {
      $executeRaw: vi.fn(),
      unit: {findUnique:vi.fn().mockResolvedValue({id:'target-1'})},
      blockedDate:{findFirst:vi.fn().mockResolvedValue({
        id:'block-1',unitId:'target-1',externalRef:'layantara:occupancy:source-1',
        startDate:new Date('2026-10-01T00:00:00Z'),endDate:new Date('2026-10-04T00:00:00Z'),reason:'ota_import',
      }),create:vi.fn()},
      booking:{findFirst:vi.fn()},
    };
    const db={$transaction:vi.fn(async (fn: (client:unknown)=>Promise<unknown>)=>fn(tx))} as unknown as PrismaClient;
    expect(await stageProtection(db,{decision,mappingVerified:true,allowWrite:true})).toEqual({status:'existing',blockId:'block-1'});
    expect(tx.blockedDate.create).not.toHaveBeenCalled();
  });
});
