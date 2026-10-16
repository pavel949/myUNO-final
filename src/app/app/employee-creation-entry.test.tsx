import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyUnoPage from './page';
import PropertyWorkspacePage from '@/app/property/page';
import { employeeHarness } from '@/modules/onboarding/employee-creation.test-support';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';

const h = vi.hoisted(() => ({ db: {} as ReturnType<typeof employeeHarness>['db'], user: vi.fn(), redirect: vi.fn((path: string): never => {
  throw new Error(`redirect:${path}`);
}) }));
vi.mock('@/lib/prisma', () => ({ get prisma() { return h.db; } }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (defaults: Record<string, string>) => defaults }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
vi.mock('@/app/actions/getActiveStay', () => ({ getActiveStayId: async () => null }));
vi.mock('@/modules/core', async () => import('@/modules/core/landing'));
vi.mock('@/modules/projects', () => ({ getOwnerPortfolioShape: vi.fn(), singleOwnerUnitId: vi.fn() }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));

let fixture: ReturnType<typeof employeeHarness>;
const workspaceLink = () => screen.queryByRole('link', { name: /^Your property workspace/ });
beforeEach(() => {
  vi.clearAllMocks();
  fixture = employeeHarness(); h.db = fixture.db;
  h.user.mockResolvedValue({ identityId: 'author', email: null, firstName: 'Synthetic', lastName: 'Creator', isAdmin: false, roles: [] });
});
afterEach(cleanup);

describe('My UNO employee creation entry uses current canonical authority (fake Prisma)', () => {
  it.each(['create_unit', 'create_complex'])('connects a %s-only employee from /app through /property to creation without granting roles', async capability => {
    fixture.state().members[0].capabilities = [capability];
    const before = structuredClone(fixture.state());
    render(await MyUnoPage());
    expect(workspaceLink()).toHaveAttribute('href', '/property');
    expect(screen.queryByRole('link', { name: /^Operations/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Control plane/ })).not.toBeInTheDocument();
    cleanup(); render(await PropertyWorkspacePage());
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Create a property draft' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/property/create');
    expect(fixture.state()).toEqual(before);
  });

  it.each(['missing-member', 'revoked-member', 'other-member', 'no-creation-capability', 'inactive-space', 'inactive-organization',
    'empty-scope', 'detached-unit', 'expired-attachment', 'expired-authority', 'unverified-authority', 'offboarded-unit', 'archived-project'])(
    'does not invent a creation entry for %s', async scenario => {
      const state = fixture.state();
      if (scenario === 'missing-member') state.members = [];
      if (scenario === 'revoked-member') state.members[0].active = false;
      if (scenario === 'other-member') state.members[0].identityId = 'other';
      if (scenario === 'no-creation-capability') state.members[0].capabilities = ['manage_tasks'];
      if (scenario === 'inactive-space') state.spaces[0].status = 'inactive';
      if (scenario === 'inactive-organization') state.organizations[0].status = 'inactive';
      if (scenario === 'empty-scope') state.attachments = [];
      if (scenario === 'detached-unit') state.attachments[0].active = false;
      if (scenario === 'expired-attachment') state.attachments[0].endsOn = new Date(0);
      if (scenario === 'expired-authority') state.projectRoles[0].effectiveTo = new Date(0);
      if (scenario === 'unverified-authority') state.projectRoles[0].provenance = 'claimed';
      if (scenario === 'offboarded-unit') state.units[0].status = 'offboarded';
      if (scenario === 'archived-project') state.projects[0].status = 'archived';
      const before = structuredClone(state);
      render(await MyUnoPage());
      expect(workspaceLink()).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Your workspaces' })).not.toBeInTheDocument();
      expect(fixture.state()).toEqual(before);
    },
  );

  it('removes a revoked creator’s home entry while preserving only their bounded read-only intake route', async () => {
    const saved = await fixture.service.create('author', fixture.unitInput());
    render(await MyUnoPage()); expect(workspaceLink()).toHaveAttribute('href', '/property'); cleanup();
    fixture.state().members[0].active = false;
    render(await MyUnoPage()); expect(workspaceLink()).not.toBeInTheDocument();
    const retained = await fixture.service.list('author');
    expect(retained.spaces).toEqual([]);
    expect(retained.items).toHaveLength(1);
    expect(retained.items[0]).toMatchObject({ id: saved.id, draft: saved.draft, hasCreationAccess: false, mayEdit: false, createdProjectId: null, createdUnitId: null });
    expect((await fixture.service.list('other')).items).toEqual([]);
    cleanup(); render(await PropertyWorkspacePage());
    expect(screen.getByRole('link')).toHaveAttribute('href', '/property/create');
  });

  it.each(['blocked', 'invited', 'merged', 'deletion_requested'])('hides the entry if the identity becomes %s after session resolution', async status => {
    const saved = await fixture.service.create('author', fixture.unitInput());
    fixture.state().identities[0].status = status;
    render(await MyUnoPage());
    expect(workspaceLink()).not.toBeInTheDocument();
    await expect(fixture.service.get('author', saved.id)).rejects.toMatchObject({ status: 403 });
    await expect(fixture.service.list('author')).rejects.toMatchObject({ status: 403 });
  });

  it('redirects an unauthenticated or disabled session before any workspace access', async () => {
    h.user.mockResolvedValue(null);
    await expect(MyUnoPage()).rejects.toThrow('redirect:/login?next=/app');
    expect(h.redirect).toHaveBeenCalledWith('/login?next=/app');
    expect(fixture.db.identity.findUnique).not.toHaveBeenCalled();
    expect(fixture.db.$transaction).not.toHaveBeenCalled();
  });

  it('preserves an independently assigned V2 workspace after creation is revoked', async () => {
    fixture.state().members[0].active = false;
    fixture.state().roles.push({ id: 'content-grant', identityId: 'author', role: 'content_contributor', status: 'active', scopeType: 'project',
      projectId: 'project', unitId: null, organizationId: null, providerId: null });
    render(await MyUnoPage());
    expect(workspaceLink()).toHaveAttribute('href', '/property');
    expect(fixture.db.$transaction).not.toHaveBeenCalled();
  });

  it.each([new Error('Unavailable creation store'), new EmployeeCreationError(409, 'Creation state changed')])(
    'does not disguise unexpected creation failures as no assigned work', async error => {
      fixture.db.$transaction.mockRejectedValueOnce(error);
      await expect(MyUnoPage()).rejects.toBe(error);
    },
  );
});
