import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity } from '@/test/util';

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

describe('GET /api/admin/prospecting', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/admin/prospecting'));
    expect(res.status).toBe(401);
  });

  it('lists prospecting accounts', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const contact = await createIdentity({ firstName: 'Prospect', lastName: 'Owner' });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    await db.prospectingAccount.create({
      data: {
        identityId: contact.id,
        accountType: 'owner',
        status: 'new',
        priority: 1,
      },
    });

    const res = await GET(new NextRequest('http://localhost/api/admin/prospecting'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].identityName).toContain('Prospect');
  });
});

describe('POST /api/admin/prospecting', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates a prospecting account', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const contact = await createIdentity();
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      new NextRequest('http://localhost/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: contact.id,
          accountType: 'developer',
          reasonForContact: 'New villa portfolio',
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account.accountType).toBe('developer');
  });
});
