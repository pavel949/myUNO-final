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
 * A guest arrives at a service with a stay, which settles which building the
 * order belongs to. Everyone else — a resident, an owner, an MC member —
 * arrives with a building instead, and the residence page links them straight
 * to `/services/{id}`.
 *
 * The route's last resort was `projects.length === 1`. That is correct only
 * while exactly one project exists: it works today and fails the day a second
 * building goes live, which is the worst possible moment to find out.
 */
describe('POST /api/service-orders — project context with more than one project (T-057)', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  async function twoProjectsAndAResident() {
    const home = await createProject();
    const elsewhere = await createProject();

    const provider = await createProvider({ status: 'active' });
    // The order path requires a vetted provider, not merely an active one.
    await db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      basePriceThb: 100_000,
    });

    const resident = await createIdentity();
    await createRoleAssignment({
      identityId: resident.id,
      role: 'resident',
      scopeType: 'project',
      projectId: home.id,
    });

    mockGetCurrentUser.mockResolvedValue({
      identityId: resident.id,
      email: resident.email,
      firstName: 'Resident',
      lastName: 'One',
      isAdmin: false,
      roles: [{ role: 'resident', projectId: home.id, unitId: null }],
    });

    return { home, elsewhere, service, resident };
  }

  function order(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/service-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('refuses an order with no context at all, rather than guessing', async () => {
    const { service } = await twoProjectsAndAResident();
    const response = await POST(
      order({
        serviceId: service.id,
        scheduledStart: new Date('2026-12-01T10:00:00.000Z').toISOString(),
        quantity: 1,
      })
    );
    expect(response.status).toBe(400);
  });

  it('accepts a resident who names their own building', async () => {
    // This is the path the residence page now takes. Before, it sent no
    // project and landed on the guess.
    const { home, service } = await twoProjectsAndAResident();
    const response = await POST(
      order({
        serviceId: service.id,
        projectId: home.id,
        scheduledStart: new Date('2026-12-01T10:00:00.000Z').toISOString(),
        quantity: 1,
      })
    );
    expect(response.status).toBe(201);

    const created = await db.serviceOrder.findFirst({ where: { project_id: home.id } });
    expect(created).not.toBeNull();
  });

  it('refuses a building the caller has no role in', async () => {
    // Naming a project in the request must not be enough on its own.
    const { elsewhere, service } = await twoProjectsAndAResident();
    const response = await POST(
      order({
        serviceId: service.id,
        projectId: elsewhere.id,
        scheduledStart: new Date('2026-12-01T10:00:00.000Z').toISOString(),
        quantity: 1,
      })
    );
    expect(response.status).toBeGreaterThanOrEqual(400);

    const leaked = await db.serviceOrder.findFirst({ where: { project_id: elsewhere.id } });
    expect(leaked).toBeNull();
  });
});
