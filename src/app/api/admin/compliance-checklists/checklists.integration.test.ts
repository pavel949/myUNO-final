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

describe('GET /api/admin/compliance-checklists', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/compliance-checklists'));
    expect(res.status).toBe(401);
  });

  it('lists checklist instances', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const template = await db.complianceChecklistTemplate.create({
      data: {
        name: 'Monthly safety',
        frequency: 'monthly',
        items: [{ label: 'Fire extinguisher', required: true }],
      },
    });

    await db.complianceChecklistInstance.create({
      data: {
        unitId: unit.id,
        templateId: template.id,
        dueDate: new Date('2026-09-15'),
      },
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/compliance-checklists'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.instances).toHaveLength(1);
    expect(body.instances[0].unitName).toBeTruthy();
  });
});

describe('POST /api/admin/compliance-checklists', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates a checklist template', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      new NextRequest('http://localhost/api/admin/compliance-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Quarterly inspection',
          frequency: 'quarterly',
          items: [{ label: 'Pool safety', required: true }],
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.name).toBe('Quarterly inspection');
  });
});
