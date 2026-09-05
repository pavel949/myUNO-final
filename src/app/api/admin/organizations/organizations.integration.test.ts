import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity } from '@/test/util';
import { createOrganization } from '@/modules/core/people.service';

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

describe('GET /api/admin/organizations', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(res.status).toBe(401);
  });

  it('lists organizations', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await createOrganization(db, {
      name: 'Test MC',
      orgType: 'management_company',
      contactEmail: 'mc@example.com',
      contactPhone: '+66812345678',
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizations).toHaveLength(1);
    expect(body.organizations[0].name).toBe('Test MC');
  });

  it('filters by orgType', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await createOrganization(db, {
      name: 'MC One',
      orgType: 'management_company',
      contactEmail: 'mc@example.com',
      contactPhone: '+66812345678',
    });
    await createOrganization(db, {
      name: 'Juristic One',
      orgType: 'juristic_person',
      contactEmail: 'jp@example.com',
      contactPhone: '+66812345678',
    });

    const res = await GET(
      new NextRequest(
        'http://localhost/api/admin/organizations?orgType=management_company'
      )
    );
    const body = await res.json();
    expect(body.organizations).toHaveLength(1);
    expect(body.organizations[0].orgType).toBe('management_company');
  });
});

describe('POST /api/admin/organizations', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates an organization', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      new NextRequest('http://localhost/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New MC',
          orgType: 'management_company',
          contactEmail: 'new@example.com',
          contactPhone: '+66812345678',
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.organization.name).toBe('New MC');
  });
});
