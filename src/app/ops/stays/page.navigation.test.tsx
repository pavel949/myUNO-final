import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { identityId: 'staff-1', isAdmin: false },
  projects: [{ id: 'project-1', name: 'Allowed project' }],
  membership: vi.fn(),
  spaceUnits: vi.fn(),
  bookings: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/app/libs/projectScope', () => ({
  getDepartmentProjectIds: async () => ['project-1'],
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: async () => state.projects },
    projectStaffPermission: { findMany: async () => [] },
    booking: { findMany: state.bookings },
  },
}));
vi.mock('@/modules/ops', () => ({
  getOperatingSpaceMembership: state.membership,
  getOperatingSpaceUnitIds: state.spaceUnits,
}));
vi.mock('@/modules/booking', () => ({ bangkokCalendarDay: () => '2026-10-10' }));
vi.mock('@/lib/i18n', () => ({
  getRequestLocale: () => 'en',
  getLabels: async (defaults: Record<string, string>) => defaults,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));

import StayOperationsPage from './page';

type SearchParams = NonNullable<Parameters<typeof StayOperationsPage>[0]['searchParams']>;

beforeEach(() => {
  state.user = { identityId: 'staff-1', isAdmin: false };
  state.projects = [{ id: 'project-1', name: 'Allowed project' }];
  state.membership.mockReset().mockResolvedValue({ active: true });
  state.spaceUnits.mockReset().mockResolvedValue(['unit-1']);
  state.bookings.mockReset().mockResolvedValue([]);
});

// Page/link regression with mocked authorization dependencies, not role-isolation E2E.
describe('stay queue back-to-calendar context', () => {
  it.each<{ name: string; params: SearchParams; href: string }>([
    { name: 'no scope', params: {}, href: '/ops/calendar/board' },
    { name: 'project', params: { projectId: 'project-1' }, href: '/ops/calendar/board?projectId=project-1' },
    { name: 'operating space', params: { spaceId: 'space-1' }, href: '/ops/calendar/board?spaceId=space-1' },
    {
      name: 'combined scope without the queue-only department',
      params: { projectId: 'project-1', spaceId: 'space-1', department: 'housekeeping' },
      href: '/ops/calendar/board?spaceId=space-1&projectId=project-1',
    },
    { name: 'department only', params: { department: 'housekeeping' }, href: '/ops/calendar/board' },
  ])('preserves $name', async ({ params, href }) => {
    render(await StayOperationsPage({ searchParams: params }));
    expect(screen.getByRole('link', { name: 'Back to calendar' })).toHaveAttribute('href', href);
    if (params.spaceId) {
      expect(state.membership).toHaveBeenCalledWith(expect.anything(), params.spaceId, 'staff-1');
    }
  });

  it('encodes project and space values without injecting additional parameters', async () => {
    const projectId = 'project /?&=+#ไทย';
    const spaceId = 'space /?&=+#РФ';
    state.projects = [{ id: projectId, name: 'Encoded project' }];
    render(await StayOperationsPage({ searchParams: { projectId, spaceId, department: 'housekeeping' } }));
    const href = screen.getByRole('link', { name: 'Back to calendar' }).getAttribute('href')!;
    const url = new URL(href, 'https://myuno.test');
    expect(url.pathname).toBe('/ops/calendar/board');
    expect(Array.from(url.searchParams.entries())).toEqual([['spaceId', spaceId], ['projectId', projectId]]);
    expect(url.hash).toBe('');
  });

  it.each([false, true])('omits an unrecognized or unauthorized project (admin=%s)', async (isAdmin) => {
    state.user.isAdmin = isAdmin;
    render(await StayOperationsPage({ searchParams: { projectId: 'foreign-project', spaceId: 'space-1' } }));
    expect(screen.getByRole('link', { name: 'Back to calendar' }))
      .toHaveAttribute('href', '/ops/calendar/board?spaceId=space-1');
    // Preserve the existing staff fallback query rather than echoing the rejected ID.
    expect(state.bookings).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: { in: ['unit-1'] } }),
    }));
    if (!isAdmin) {
      expect(state.bookings).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ projectId: { in: ['project-1'] } }),
      }));
    }
  });

  it.each([null, { active: false }])('still rejects unauthorized space before rendering a link (%j)', async (membership) => {
    state.membership.mockResolvedValue(membership);
    await expect(StayOperationsPage({ searchParams: { projectId: 'project-1', spaceId: 'foreign-space' } }))
      .rejects.toThrow('redirect:/ops/spaces');
    expect(state.spaceUnits).not.toHaveBeenCalled();
    expect(state.bookings).not.toHaveBeenCalled();
  });
});
