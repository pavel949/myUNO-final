import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings/me');
}

const asUser = (identityId: string) => ({
  identityId,
  email: 'x@test.com',
  firstName: 'X',
  lastName: 'Y',
  isAdmin: false,
  roles: [],
});

describe('GET /api/bookings/me — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns totalThb converted to baht, not raw satang', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    // 500000 satang stored — the correct on-screen figure is ฿5,000, not ฿500,000.
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      totalThb: 500000,
    });

    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].totalThb).toBe(5000);
  });
});
