import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption';
import {
  createBooking,
  createIdentity,
  createProject,
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

import { GET as getPassport } from './passport/route';
import { POST as markFiled } from './file/route';
import { POST as markFailed } from './fail/route';

describe('TM30 filing scoped authorization', () => {
  let staff: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let otherProjectId: string;
  let filingId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    staff = await createIdentity({ firstName: 'Host' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const guest = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    const otherProject = await createProject({ status: 'live' });
    projectId = project.id;
    otherProjectId = otherProject.id;
    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId,
      guestIdentityId: guest.id,
      status: 'checked_in',
    });

    const bookingGuest = await db.bookingGuest.create({
      data: {
        bookingId: booking.id,
        fullName: encrypt('Ivan Petrov'),
        passportNumber: encrypt('AB1234567'),
        dateOfBirth: encrypt('1990-01-01'),
        nationality: 'RU',
        isLead: true,
      },
    });

    const filing = await db.tm30Filing.create({
      data: {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: 'pending',
      },
    });
    filingId = filing.id;
  });

  function asHostFor(project: string) {
    mockGetCurrentUser.mockResolvedValue({
      identityId: staff.id,
      email: staff.email,
      firstName: 'Host',
      lastName: 'User',
      isAdmin: false,
      roles: [
        {
          role: 'onsite_host',
          projectId: project,
          unitId: null,
          organizationId: null,
          providerId: null,
        },
      ],
    });
  }

  it('allows onsite host in project to read passport details', async () => {
    asHostFor(projectId);
    const response = await getPassport(
      new NextRequest(`http://localhost/api/tm30/${filingId}/passport`),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.passportNumber).toBe('AB1234567');
  });

  it('blocks passport access for onsite host outside project scope', async () => {
    asHostFor(otherProjectId);
    const response = await getPassport(
      new NextRequest(`http://localhost/api/tm30/${filingId}/passport`),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(403);
  });

  it('allows onsite host in project to mark filing as filed', async () => {
    asHostFor(projectId);
    const response = await markFiled(
      new NextRequest(`http://localhost/api/tm30/${filingId}/file`, {
        method: 'POST',
        body: JSON.stringify({ receiptMediaId: null }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(200);

    const filing = await db.tm30Filing.findUnique({ where: { id: filingId } });
    expect(filing?.status).toBe('filed');
  });

  it('blocks mark-filed for onsite host outside project scope', async () => {
    asHostFor(otherProjectId);
    const response = await markFiled(
      new NextRequest(`http://localhost/api/tm30/${filingId}/file`, {
        method: 'POST',
        body: JSON.stringify({ receiptMediaId: null }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(403);
  });

  it('allows MC member with managed-unit engagement to mark filing as filed', async () => {
    const owner = await createIdentity({ firstName: 'Owner' });
    const mcMember = await createIdentity({ firstName: 'MC' });
    const project = await db.project.findUnique({ where: { id: projectId } });
    const unit = await createUnit({ projectId: project!.id, ownerIdentityId: owner.id, status: 'live' });
    const mcOrg = await db.organization.create({
      data: {
        name: 'MC',
        orgType: 'management_company',
        projectId: projectId,
        contactEmail: 'mc@test.com',
        contactPhone: '555-0099',
      },
    });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        engagementType: 'via_management_company',
        ownerIdentityId: owner.id,
        managementOrgId: mcOrg.id,
        status: 'active',
      },
    });
    await db.roleAssignment.create({
      data: {
        identityId: mcMember.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId,
        organizationId: mcOrg.id,
      },
    });

    const guest = await createIdentity({ firstName: 'Guest2' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId,
      guestIdentityId: guest.id,
      status: 'checked_in',
    });
    const bookingGuest = await db.bookingGuest.create({
      data: {
        bookingId: booking.id,
        fullName: encrypt('Anna Guest'),
        passportNumber: encrypt('XY9876543'),
        dateOfBirth: encrypt('1992-02-02'),
        nationality: 'RU',
        isLead: true,
      },
    });
    const mcFiling = await db.tm30Filing.create({
      data: {
        bookingId: booking.id,
        bookingGuestId: bookingGuest.id,
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        status: 'pending',
      },
    });

    mockGetCurrentUser.mockResolvedValue({
      identityId: mcMember.id,
      email: mcMember.email,
      firstName: 'MC',
      lastName: 'Member',
      isAdmin: false,
      roles: [
        {
          role: 'mc_member',
          projectId,
          unitId: null,
          organizationId: mcOrg.id,
          providerId: null,
        },
      ],
    });

    const response = await markFiled(
      new NextRequest(`http://localhost/api/tm30/${mcFiling.id}/file`, {
        method: 'POST',
        body: JSON.stringify({ receiptMediaId: null }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: mcFiling.id } }
    );
    expect(response.status).toBe(200);
  });

  it('allows onsite host in project to mark filing as failed with note', async () => {
    asHostFor(projectId);
    const response = await markFailed(
      new NextRequest(`http://localhost/api/tm30/${filingId}/fail`, {
        method: 'POST',
        body: JSON.stringify({ failureNote: 'Portal unavailable' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(200);

    const filing = await db.tm30Filing.findUnique({ where: { id: filingId } });
    expect(filing?.status).toBe('failed');
    expect(filing?.failureNote).toBe('Portal unavailable');
  });

  it('blocks mark-failed for onsite host outside project scope', async () => {
    asHostFor(otherProjectId);
    const response = await markFailed(
      new NextRequest(`http://localhost/api/tm30/${filingId}/fail`, {
        method: 'POST',
        body: JSON.stringify({ failureNote: 'Portal unavailable' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: filingId } }
    );
    expect(response.status).toBe(403);
  });
});
