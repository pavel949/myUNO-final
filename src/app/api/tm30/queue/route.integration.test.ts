import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createBooking,
  createBookingGuest,
  createIdentity,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
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

function asUser(identity: { id: string; email: string | null }, roles: Array<{
  role: string;
  projectId: string | null;
  unitId: string | null;
  organizationId: string | null;
  providerId: string | null;
}>) {
  mockGetCurrentUser.mockResolvedValue({
    identityId: identity.id,
    email: identity.email,
    firstName: 'Staff',
    lastName: 'User',
    isAdmin: false,
    roles,
  });
}

describe('GET /api/tm30/queue', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('allows onsite hosts for their project and blocks other projects', async () => {
    const staff = await createIdentity();
    const guest = await createIdentity();
    const projectA = await createProject({ name: 'Project A', status: 'live' });
    const projectB = await createProject({ name: 'Project B', status: 'live' });
    const unitA = await createUnit({ projectId: projectA.id, status: 'live' });
    const unitB = await createUnit({ projectId: projectB.id, status: 'live' });

    await createRoleAssignment({
      identityId: staff.id,
      role: 'onsite_host',
      scopeType: 'project',
      projectId: projectA.id,
    });

    const bookingA = await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guest.id,
      startDate: new Date('2026-08-10T10:00:00Z'),
      endDate: new Date('2026-08-12T10:00:00Z'),
      status: 'checked_in',
    });
    const bookingB = await createBooking({
      unitId: unitB.id,
      projectId: projectB.id,
      guestIdentityId: guest.id,
      startDate: new Date('2026-08-11T10:00:00Z'),
      endDate: new Date('2026-08-13T10:00:00Z'),
      status: 'checked_in',
    });

    const guestA = await createBookingGuest({
      bookingId: bookingA.id,
      fullName: 'Guest A',
      nationality: 'RU',
      passportNumber: 'PA123456',
      isLead: true,
    });
    const guestB = await createBookingGuest({
      bookingId: bookingB.id,
      fullName: 'Guest B',
      nationality: 'RU',
      passportNumber: 'PB123456',
      isLead: true,
    });

    await db.tm30Filing.create({
      data: {
        bookingId: bookingA.id,
        bookingGuestId: guestA.id,
        dueAt: new Date('2026-08-11T10:00:00Z'),
        status: 'pending',
      },
    });
    await db.tm30Filing.create({
      data: {
        bookingId: bookingB.id,
        bookingGuestId: guestB.id,
        dueAt: new Date('2026-08-11T11:00:00Z'),
        status: 'pending',
      },
    });

    asUser(staff, [
      {
        role: 'onsite_host',
        projectId: projectA.id,
        unitId: null,
        organizationId: null,
        providerId: null,
      },
    ]);

    const allowed = await GET(
      new NextRequest(`http://localhost/api/tm30/queue?projectId=${projectA.id}`)
    );
    expect(allowed.status).toBe(200);
    const allowedBody = await allowed.json();
    expect(allowedBody.total).toBe(1);
    expect(allowedBody.queue[0]?.bookingId).toBe(bookingA.id);

    const denied = await GET(
      new NextRequest(`http://localhost/api/tm30/queue?projectId=${projectB.id}`)
    );
    expect(denied.status).toBe(403);
  });
});
