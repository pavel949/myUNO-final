import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBooking,
  createIdentity,
  createProject,
  createProvider,
  createService,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import { getOpsBoard, getOpsMobilizationQueue, getOpsBookingRequests } from './ops-board.service';

describe('getOpsBoard', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('filters bookings, service orders, and SLA metrics by scoped projects', async () => {
    const now = new Date('2026-08-15T10:00:00Z');

    const guestA = await createIdentity({ firstName: 'Guest', lastName: 'A' });
    const guestB = await createIdentity({ firstName: 'Guest', lastName: 'B' });
    const projectA = await createProject({ name: 'Project A', status: 'live' });
    const projectB = await createProject({ name: 'Project B', status: 'live' });
    const unitA = await createUnit({ projectId: projectA.id, name: 'Unit A', status: 'live' });
    const unitB = await createUnit({ projectId: projectB.id, name: 'Unit B', status: 'live' });

    await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guestA.id,
      status: 'requested',
      startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      totalThb: 80_000,
    });
    await createBooking({
      unitId: unitB.id,
      projectId: projectB.id,
      guestIdentityId: guestB.id,
      status: 'requested',
      startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      totalThb: 90_000,
    });
    await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guestA.id,
      status: 'pending_payment',
      startDate: now,
      endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      totalThb: 100_000,
    });
    await createBooking({
      unitId: unitB.id,
      projectId: projectB.id,
      guestIdentityId: guestB.id,
      status: 'pending_payment',
      startDate: now,
      endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      totalThb: 120_000,
    });

    const provider = await createProvider({ status: 'active' });
    const serviceA = await createService({
      providerId: provider.id,
      title: 'Service A',
      status: 'active',
      basePriceThb: 10_000,
    });
    const serviceB = await createService({
      providerId: provider.id,
      title: 'Service B',
      status: 'active',
      basePriceThb: 12_000,
    });

    await db.serviceOrder.create({
      data: {
        service_id: serviceA.id,
        provider_id: provider.id,
        project_id: projectA.id,
        unit_id: unitA.id,
        orderer_identity_id: guestA.id,
        orderer_role: 'guest',
        status: 'placed',
        scheduled_start: now,
        scheduled_end: new Date(now.getTime() + 60 * 60 * 1000),
        quantity: 1,
        price_breakdown: { base_thb: 10_000, quantity: 1, total_thb: 10_000 },
        total_thb: 10_000,
        take_rate_pct_snapshot: 15,
      },
    });
    await db.serviceOrder.create({
      data: {
        service_id: serviceB.id,
        provider_id: provider.id,
        project_id: projectB.id,
        unit_id: unitB.id,
        orderer_identity_id: guestB.id,
        orderer_role: 'guest',
        status: 'placed',
        scheduled_start: now,
        scheduled_end: new Date(now.getTime() + 60 * 60 * 1000),
        quantity: 1,
        price_breakdown: { base_thb: 12_000, quantity: 1, total_thb: 12_000 },
        total_thb: 12_000,
        take_rate_pct_snapshot: 15,
      },
    });

    await db.ticket.create({
      data: {
        projectId: projectA.id,
        unitId: unitA.id,
        raisedByIdentityId: guestA.id,
        raisedByRole: 'guest',
        categoryKey: 'ops.test',
        title: 'Ticket A',
        priority: 'normal',
        status: 'open',
        slaDueAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    await db.ticket.create({
      data: {
        projectId: projectA.id,
        unitId: unitA.id,
        raisedByIdentityId: guestA.id,
        raisedByRole: 'guest',
        categoryKey: 'ops.test',
        title: 'Ticket A resolved',
        priority: 'normal',
        status: 'resolved',
        slaDueAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    await db.ticket.create({
      data: {
        projectId: projectB.id,
        unitId: unitB.id,
        raisedByIdentityId: guestB.id,
        raisedByRole: 'guest',
        categoryKey: 'ops.test',
        title: 'Ticket B',
        priority: 'normal',
        status: 'open',
        slaDueAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });

    const scoped = await getOpsBoard(db, now, { projectIds: [projectA.id] });
    expect(scoped.arrivals).toHaveLength(1);
    expect(scoped.arrivals[0]?.unit.name).toBe('Unit A');
    expect(scoped.pendingRequests).toHaveLength(1);
    expect(scoped.pendingRequests[0]?.unit.name).toBe('Unit A');
    expect(scoped.pendingPayment).toHaveLength(1);
    expect(scoped.pendingPayment[0]?.unit.name).toBe('Unit A');
    expect(scoped.pendingServiceOrders).toHaveLength(1);
    expect(scoped.pendingServiceOrders[0]?.service.title).toBe('Service A');
    expect(scoped.openTickets).toHaveLength(1);
    expect(scoped.openTickets[0]?.title).toBe('Ticket A');
    expect(scoped.slaMetrics.ticketsWithOpenSLA).toBe(1);

    const unscoped = await getOpsBoard(db, now);
    expect(unscoped.pendingRequests.length).toBe(2);
    expect(unscoped.pendingPayment.length).toBe(2);
    expect(unscoped.pendingServiceOrders.length).toBe(2);
    expect(unscoped.openTickets.length).toBe(2);
    expect(unscoped.slaMetrics.ticketsWithOpenSLA).toBe(2);
  });

  it('returns an empty board when called with an explicit empty scope', async () => {
    const scoped = await getOpsBoard(db, new Date('2026-08-15T10:00:00Z'), { projectIds: [] });
    expect(scoped.arrivals).toEqual([]);
    expect(scoped.departures).toEqual([]);
    expect(scoped.pendingRequests).toEqual([]);
    expect(scoped.pendingPayment).toEqual([]);
    expect(scoped.pendingServiceOrders).toEqual([]);
    expect(scoped.openTickets).toEqual([]);
    expect(scoped.slaMetrics.tm30OnTimeRate7d).toBe(100);
    expect(scoped.slaMetrics.ticketsWithOpenSLA).toBe(0);
  });

  it('lists mobilizing units with checklist progress, scoped by project', async () => {
    const projectA = await createProject({ name: 'Project A' });
    const projectB = await createProject({ name: 'Project B' });
    const unitA = await createUnit({ projectId: projectA.id, name: 'Mob A', status: 'mobilizing' });
    await createUnit({ projectId: projectB.id, name: 'Mob B', status: 'draft' });
    await createUnit({ projectId: projectA.id, name: 'Live A', status: 'live' });

    await db.mobilizationChecklistItem.createMany({
      data: [
        { unitId: unitA.id, step: 'qualify', status: 'done' },
        { unitId: unitA.id, step: 'mandate', status: 'pending' },
      ],
    });
    await db.mobilizationChecklistItem.update({
      where: { unitId_step: { unitId: unitA.id, step: 'qualify' } },
      data: { completedAt: new Date() },
    });

    const scoped = await getOpsMobilizationQueue(db, { projectIds: [projectA.id] });
    expect(scoped).toHaveLength(1);
    expect(scoped[0].name).toBe('Mob A');
    expect(scoped[0].completedSteps).toBe(1);
    expect(scoped[0].nextStep).toBe('mandate');

    const all = await getOpsMobilizationQueue(db);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getOpsBookingRequests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns pending requests scoped by project, ordered by deadline', async () => {
    const guestA = await createIdentity({ firstName: 'Guest', lastName: 'A' });
    const guestB = await createIdentity({ firstName: 'Guest', lastName: 'B' });
    const projectA = await createProject({ name: 'Project A', status: 'live' });
    const projectB = await createProject({ name: 'Project B', status: 'live' });
    const unitA = await createUnit({ projectId: projectA.id, name: 'Unit A', status: 'live' });
    const unitB = await createUnit({ projectId: projectB.id, name: 'Unit B', status: 'live' });

    const later = new Date('2026-08-20T12:00:00Z');
    const sooner = new Date('2026-08-18T12:00:00Z');

    const requestLater = await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guestA.id,
      status: 'requested',
      startDate: new Date('2026-08-25T00:00:00Z'),
      endDate: new Date('2026-08-28T00:00:00Z'),
      totalThb: 80_000,
    });
    await db.booking.update({
      where: { id: requestLater.id },
      data: { requestExpiresAt: later },
    });

    const requestSooner = await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guestA.id,
      status: 'requested',
      startDate: new Date('2026-08-22T00:00:00Z'),
      endDate: new Date('2026-08-24T00:00:00Z'),
      totalThb: 70_000,
    });
    await db.booking.update({
      where: { id: requestSooner.id },
      data: { requestExpiresAt: sooner },
    });
    await createBooking({
      unitId: unitB.id,
      projectId: projectB.id,
      guestIdentityId: guestB.id,
      status: 'requested',
      startDate: new Date('2026-08-25T00:00:00Z'),
      endDate: new Date('2026-08-28T00:00:00Z'),
      totalThb: 90_000,
    });
    await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guestA.id,
      status: 'confirmed',
      startDate: new Date('2026-08-25T00:00:00Z'),
      endDate: new Date('2026-08-28T00:00:00Z'),
      totalThb: 100_000,
    });

    const scoped = await getOpsBookingRequests(db, { projectIds: [projectA.id] });
    expect(scoped).toHaveLength(2);
    expect(scoped[0]?.unit.name).toBe('Unit A');
    expect(scoped[0]?.requestExpiresAt?.toISOString()).toBe(sooner.toISOString());
    expect(scoped[0]?.projectName).toBe('Project A');

    const all = await getOpsBookingRequests(db);
    expect(all).toHaveLength(3);

    const empty = await getOpsBookingRequests(db, { projectIds: [] });
    expect(empty).toEqual([]);
  });
});
