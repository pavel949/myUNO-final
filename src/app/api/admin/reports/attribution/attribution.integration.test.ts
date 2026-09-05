import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';

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

describe('GET /api/admin/reports/attribution', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 403 for non-admin', async () => {
    const user = await createIdentity({ isAdmin: false });
    mockGetCurrentUser.mockResolvedValue({
      identityId: user.id,
      email: user.email,
      firstName: 'Guest',
      lastName: 'User',
      isAdmin: false,
      roles: [],
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns attribution metrics for admin', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const channel = await db.channel.create({
      data: { name: 'Direct', category: 'owned' },
    });

    const identity = await createIdentity();
    await db.crmProfile.create({
      data: {
        identityId: identity.id,
        lifecycleStage: 'guest',
        sourceChannelId: channel.id,
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalProfiles).toBe(1);
    expect(body.metrics.some((m: { channelName: string }) => m.channelName === 'Direct')).toBe(
      true
    );
  });
});
