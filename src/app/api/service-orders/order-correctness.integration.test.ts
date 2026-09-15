import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createProvider,
  createService,
  createRoleAssignment,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

/**
 * Three things the order route used to get quietly wrong. None of them failed
 * loudly: the order was created either way, carrying a wrong number.
 */
describe('POST /api/service-orders — what the order records', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  async function scene(priceModel: 'fixed' | 'per_person', durationMin = 60) {
    const project = await createProject();
    const provider = await createProvider({ status: 'active' });
    await db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      basePriceThb: 100_000,
    });
    await db.service.update({
      where: { id: service.id },
      data: { priceModel, durationMin },
    });
    return { project, service };
  }

  function actAs(identityId: string, roles: { role: string; projectId: string | null; unitId: string | null }[]) {
    mockGetCurrentUser.mockResolvedValue({
      identityId,
      email: 'x@example.com',
      firstName: 'A',
      lastName: 'B',
      isAdmin: false,
      roles,
    });
  }

  function order(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/service-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const startAt = new Date('2026-12-01T10:00:00.000Z');

  it('refuses a quantity over the cap instead of silently booking fewer', async () => {
    // It used to clamp 25 to 20: the person was charged for twenty and told
    // nothing, having asked for twenty-five.
    const { project, service } = await scene('fixed');
    const resident = await createIdentity();
    await createRoleAssignment({
      identityId: resident.id, role: 'resident', scopeType: 'project', projectId: project.id,
    });
    actAs(resident.id, [{ role: 'resident', projectId: project.id, unitId: null }]);

    const response = await POST(
      order({ serviceId: service.id, projectId: project.id, scheduledStart: startAt.toISOString(), quantity: 25 })
    );

    expect(response.status).toBe(400);
    expect(await db.serviceOrder.count()).toBe(0);
  });

  it('does not stretch a per-person booking across the provider’s day', async () => {
    // Four guests at a one-hour service is one hour, not four. The slot used
    // to scale with quantity whatever the price model meant by it, which held
    // three hours of a provider's calendar that nobody had booked.
    const { project, service } = await scene('per_person', 60);
    const resident = await createIdentity();
    await createRoleAssignment({
      identityId: resident.id, role: 'resident', scopeType: 'project', projectId: project.id,
    });
    actAs(resident.id, [{ role: 'resident', projectId: project.id, unitId: null }]);

    const response = await POST(
      order({ serviceId: service.id, projectId: project.id, scheduledStart: startAt.toISOString(), quantity: 4 })
    );
    expect(response.status).toBe(201);

    const created = await db.serviceOrder.findFirstOrThrow();
    const minutes =
      (created.scheduled_end.getTime() - created.scheduled_start.getTime()) / 60_000;
    expect(minutes).toBe(60);
    // The money still counts every guest.
    expect(created.total_thb).toBe(400_000);
  });

  it('records the role the order was placed in, not whichever came first', async () => {
    // An identity can be an owner and a resident at once. `roles[0]` recorded
    // one of them arbitrarily, and that role follows the order into
    // statements, notifications and the permission matrix.
    const { project, service } = await scene('fixed');
    const person = await createIdentity();
    const elsewhere = await createProject();
    await createRoleAssignment({
      identityId: person.id, role: 'owner', scopeType: 'project', projectId: elsewhere.id,
    });
    await createRoleAssignment({
      identityId: person.id, role: 'resident', scopeType: 'project', projectId: project.id,
    });
    // Deliberately ordered so the irrelevant role sits first.
    actAs(person.id, [
      { role: 'owner', projectId: elsewhere.id, unitId: null },
      { role: 'resident', projectId: project.id, unitId: null },
    ]);

    const response = await POST(
      order({ serviceId: service.id, projectId: project.id, scheduledStart: startAt.toISOString(), quantity: 1 })
    );
    expect(response.status).toBe(201);

    const created = await db.serviceOrder.findFirstOrThrow();
    expect(created.orderer_role).toBe('resident');
  });
});
