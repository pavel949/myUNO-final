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

import { GET } from './route';

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

async function seedIncident(status: 'open' | 'resolved' = 'open') {
  const project = await createProject({ status: 'live' });
  const owner = await createIdentity();
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const reporter = await createIdentity();
  return db.incidentLog.create({
    data: {
      unitId: unit.id,
      incidentType: 'maintenance',
      severity: 'medium',
      description: 'Leaking tap in master bath',
      reportedByIdentityId: reporter.id,
      status,
    },
  });
}

describe('GET /api/admin/incidents', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/incidents'));
    expect(res.status).toBe(401);
  });

  it('returns incidents with unit and reporter details', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await seedIncident('open');

    const res = await GET(
      new NextRequest(
        'http://localhost/api/admin/incidents?statuses=open,acknowledged,in_progress'
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0].unitName).toBeTruthy();
    expect(body.incidents[0].reportedBy.name).toBeTruthy();
  });

  it('filters by status group', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await seedIncident('open');
    await seedIncident('resolved');

    const res = await GET(
      new NextRequest('http://localhost/api/admin/incidents?statuses=resolved,closed')
    );
    const body = await res.json();
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0].status).toBe('resolved');
  });
});
