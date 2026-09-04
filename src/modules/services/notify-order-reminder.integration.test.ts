import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createProvider,
  createService,
  createRoleAssignment,
} from '@/test/util';
import { remindUnansweredServiceOrders } from './notify-order-reminder';

describe('remindUnansweredServiceOrders (N-26 half-SLA)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('sends reminder to provider members when order is past half-SLA and still unanswered', async () => {
    const project = await createProject();
    const unit = await createUnit(project.id);
    const provider = await createProvider({ status: 'active' });
    const member = await createIdentity();
    await createRoleAssignment({
      identityId: member.id,
      role: 'provider_member',
      providerId: provider.id,
    });
    const orderer = await createIdentity();
    const service = await createService({
      providerId: provider.id,
      categoryKey: 'cleaning',
      status: 'active',
      title: 'Pool cleaning',
    });

    const createdAt = new Date('2026-08-01T00:00:00Z');
    const now = new Date('2026-08-01T07:00:00Z'); // 7h later — past 6h half of 12h SLA

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        status: 'placed',
        scheduled_start: new Date('2026-08-02'),
        scheduled_end: new Date('2026-08-02T02:00:00Z'),
        quantity: 1,
        price_breakdown: { base: 1000 },
        total_thb: 1000,
        take_rate_pct_snapshot: 15,
        createdAt,
      },
    });

    const reminded = await remindUnansweredServiceOrders(db, now);
    expect(reminded).toBe(1);

    const notifications = await db.notification.findMany({
      where: {
        type: 'order_new',
        bodyKey: 'order.new.reminder.body',
      },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].identityId).toBe(member.id);
    expect((notifications[0].params as { order_id?: string }).order_id).toBe(order.id);

    expect(await remindUnansweredServiceOrders(db, now)).toBe(0);
  });

  it('does not remind before half-SLA elapses', async () => {
    const project = await createProject();
    const unit = await createUnit(project.id);
    const provider = await createProvider({ status: 'active' });
    const orderer = await createIdentity();
    const service = await createService({
      providerId: provider.id,
      status: 'active',
    });

    const createdAt = new Date('2026-08-01T00:00:00Z');
    const now = new Date('2026-08-01T02:00:00Z'); // 2h — before 6h half-point

    await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        status: 'paid',
        scheduled_start: new Date('2026-08-02'),
        scheduled_end: new Date('2026-08-02T02:00:00Z'),
        quantity: 1,
        price_breakdown: { base: 1000 },
        total_thb: 1000,
        take_rate_pct_snapshot: 15,
        createdAt,
      },
    });

    expect(await remindUnansweredServiceOrders(db, now)).toBe(0);
  });
});
