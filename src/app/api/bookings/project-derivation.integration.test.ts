import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config';

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
 * A booking belongs to the project its unit is in — never to the project the
 * request body names.
 *
 * The route used to take `projectId` from the client and file it unchecked. A
 * caller could book a villa in project A and have the booking recorded against
 * project B: wrong ledger, wrong metrics, wrong MC dashboard — and, because the
 * cancellation policy is resolved against project-scoped config overrides
 * before being snapshotted, the guest was sold project B's terms on project A's
 * villa, frozen into a record the database then refuses to let anyone correct.
 */
describe('POST /api/bookings derives the project from the unit', () => {
  const START = '2026-12-10';
  const END = '2026-12-14';

  let homeProjectId: string;
  let otherProjectId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);

    const home = await createProject({ slug: 'home-project', status: 'live' });
    const other = await createProject({ slug: 'other-project', status: 'live' });
    homeProjectId = home.id;
    otherProjectId = other.id;

    const unit = await createUnit({
      projectId: homeProjectId,
      name: 'Villa A',
      status: 'live',
      instantBook: true,
      baseNightlyThb: 500_000,
    });
    unitId = unit.id;

    const guest = await createIdentity();
    mockGetCurrentUser.mockReturnValue({ identityId: guest.id, isAdmin: false });
  });

  function request(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const bookingBody = (extra: Record<string, unknown>) => ({
    unitId,
    startDate: START,
    endDate: END,
    adultsCount: 2,
    childrenCount: 0,
    instantBook: true,
    paymentMethod: 'cash',
    ...extra,
  });

  it("files the booking under the unit's project when the body agrees", async () => {
    const res = await POST(request(bookingBody({ projectId: homeProjectId })));
    expect(res.status).toBe(201);

    const booking = await db.booking.findFirstOrThrow({ where: { unitId } });
    expect(booking.projectId).toBe(homeProjectId);
  });

  it('refuses a projectId that is not the unit\'s project', async () => {
    const res = await POST(request(bookingBody({ projectId: otherProjectId })));

    expect(res.status).toBe(400);
    // Refused outright, not silently corrected — a caller sending the wrong
    // project is a bug that should surface, not be papered over.
    expect(await db.booking.count()).toBe(0);
  });

  it('needs no projectId at all on the unitId path', async () => {
    const res = await POST(request(bookingBody({})));
    expect(res.status).toBe(201);

    const booking = await db.booking.findFirstOrThrow({ where: { unitId } });
    expect(booking.projectId).toBe(homeProjectId);
  });

  it('still requires a projectId on the category path, where it scopes the search', async () => {
    const res = await POST(
      request({
        categoryKey: 'garden_villa',
        startDate: START,
        endDate: END,
        adultsCount: 2,
        childrenCount: 0,
        paymentMethod: 'cash',
      })
    );

    expect(res.status).toBe(400);
  });

  it('will not sell a live villa whose project has been archived', async () => {
    await db.unit.update({
      where: { id: unitId },
      data: { categoryKey: 'garden_villa' },
    });
    await db.project.update({
      where: { id: homeProjectId },
      data: { status: 'archived' },
    });

    const res = await POST(
      request({
        categoryKey: 'garden_villa',
        projectId: homeProjectId,
        startDate: START,
        endDate: END,
        adultsCount: 2,
        childrenCount: 0,
        paymentMethod: 'cash',
      })
    );

    // Archiving a project used to stop its pages without stopping its sales.
    expect(res.status).toBe(409);
    expect(await db.booking.count()).toBe(0);
  });
});
