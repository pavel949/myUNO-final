import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createProvider,
  createService,
} from '@/test/util';
import { fulfillServiceOrderAtomic } from './fulfilment-atomic.service';

describe('atomic service fulfilment', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('commits fulfilled state and snapshotted commission together and refuses a second earning', async () => {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id });
    const orderer = await createIdentity();
    const provider = await createProvider();
    const service = await createService({ providerId: provider.id });

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        scheduled_start: new Date('2026-09-10T03:00:00Z'),
        scheduled_end: new Date('2026-09-10T04:00:00Z'),
        quantity: 1,
        price_breakdown: { total_thb: 100000 },
        total_thb: 100000,
        take_rate_pct_snapshot: 15,
        status: 'accepted',
      },
    });

    await fulfillServiceOrderAtomic(db, order.id, provider.id);

    const fulfilled = await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    const commissions = await db.ledgerEntry.findMany({
      where: { serviceOrderId: order.id, entryType: 'service_commission' },
    });

    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.fulfilled_at).not.toBeNull();
    expect(commissions).toHaveLength(1);
    expect(commissions[0].amountThb).toBe(15000);
    expect(commissions[0].occurredOn.getTime()).toBe(fulfilled.fulfilled_at!.getTime());

    await expect(fulfillServiceOrderAtomic(db, order.id, provider.id)).rejects.toThrow(
      'Cannot fulfill order in fulfilled status'
    );

    expect(
      await db.ledgerEntry.count({
        where: { serviceOrderId: order.id, entryType: 'service_commission' },
      })
    ).toBe(1);
  });
});
