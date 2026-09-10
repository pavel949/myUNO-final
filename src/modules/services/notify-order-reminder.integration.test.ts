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
import { remindUnansweredServiceOrders, sendServiceOrderReviewPrompts } from './notify-order-reminder';

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

describe('sendServiceOrderReviewPrompts (N-27)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('sends review prompt after fulfilment delay, once, and skips recent orders', async () => {
    const project = await createProject();
    const unit = await createUnit(project.id);
    const provider = await createProvider({ status: 'active' });
    const orderer = await createIdentity();
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      title: 'Airport transfer',
    });

    const fulfilledAt = new Date('2026-08-01T00:00:00Z');
    const now = new Date('2026-08-01T13:00:00Z'); // 13h later

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        status: 'fulfilled',
        fulfilled_at: fulfilledAt,
        scheduled_start: new Date('2026-08-02'),
        scheduled_end: new Date('2026-08-02T02:00:00Z'),
        quantity: 1,
        price_breakdown: { base: 1000 },
        total_thb: 1000,
        take_rate_pct_snapshot: 15,
      },
    });

    const recentOrderer = await createIdentity();
    await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: recentOrderer.id,
        orderer_role: 'guest',
        status: 'fulfilled',
        fulfilled_at: new Date('2026-08-01T10:00:00Z'), // 3h ago
        scheduled_start: new Date('2026-08-02'),
        scheduled_end: new Date('2026-08-02T02:00:00Z'),
        quantity: 1,
        price_breakdown: { base: 500 },
        total_thb: 500,
        take_rate_pct_snapshot: 15,
      },
    });

    expect(await sendServiceOrderReviewPrompts(db, now)).toBe(1);
    expect(await sendServiceOrderReviewPrompts(db, now)).toBe(0);

    const notifications = await db.notification.findMany({
      where: { type: 'order_review_prompt' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].identityId).toBe(orderer.id);
    expect((notifications[0].params as { order_id?: string }).order_id).toBe(order.id);
  });

  it('still prompts an order that has already closed (T-023b regression)', async () => {
    // T-023b gave a fulfilled order a terminal `closed` state. This query
    // filtered on `fulfilled` alone, so any order that closed before its
    // prompt was due silently lost its review prompt forever.
    //
    // Two ordinary paths reach that: the orderer confirming early — which
    // closes the order within minutes of fulfilment, well before the 12h
    // prompt — and a project shortening
    // `service.fulfilment_confirm_window_hours` below the prompt delay.
    // Both mean the happiest customers are the ones never asked to rate.
    const project = await createProject();
    const unit = await createUnit(project.id);
    const provider = await createProvider({ status: 'active' });
    const orderer = await createIdentity();
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      title: 'Private chef',
    });

    const fulfilledAt = new Date('2026-08-01T00:00:00Z');
    const now = new Date('2026-08-01T13:00:00Z'); // 13h later, prompt is due

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'guest',
        // Confirmed early by the orderer, an hour after the work was done.
        status: 'closed',
        fulfilled_at: fulfilledAt,
        closed_at: new Date('2026-08-01T01:00:00Z'),
        closed_by_identity_id: orderer.id,
        scheduled_start: new Date('2026-08-02'),
        scheduled_end: new Date('2026-08-02T02:00:00Z'),
        quantity: 1,
        price_breakdown: { base: 3000 },
        total_thb: 3000,
        take_rate_pct_snapshot: 15,
      },
    });

    expect(await sendServiceOrderReviewPrompts(db, now)).toBe(1);

    const notifications = await db.notification.findMany({
      where: { type: 'order_review_prompt' },
    });
    expect(notifications).toHaveLength(1);
    expect((notifications[0].params as { order_id?: string }).order_id).toBe(order.id);
  });
});
