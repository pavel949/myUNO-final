import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET, POST } from './route';

function adminUser(identity: { id: string; email: string | null }) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    roles: [],
  };
}

describe('GET /api/admin/operational-kpis', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/operational-kpis'));
    expect(res.status).toBe(401);
  });

  it('lists KPIs for a unit', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    await db.operationalKpi.create({
      data: {
        unitId: unit.id,
        metricName: 'occupancy_rate',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        targetValue: 75,
        actualValue: 68,
        status: 'at_risk',
      },
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/operational-kpis'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis).toHaveLength(1);
    expect(body.kpis[0].metricName).toBe('occupancy_rate');
  });
});

describe('POST /api/admin/operational-kpis', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates a KPI record', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      new NextRequest('http://localhost/api/admin/operational-kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          metricName: 'gross_booking_revenue',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          targetValue: 500000,
          actualValue: 420000,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpi.metricName).toBe('gross_booking_revenue');
  });
});
