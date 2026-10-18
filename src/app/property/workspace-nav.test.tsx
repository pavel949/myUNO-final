import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PropertyWorkspaceNav from './workspace-nav';
import PropertyContentPage from './content/page';

const h = vi.hoisted(() => ({ actor: vi.fn(), roles: vi.fn(), creation: vi.fn(), user: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { identity: { findUnique: h.actor }, roleAssignment: { findMany: h.roles } } }));
vi.mock('@/modules/onboarding/employee-creation.service', () => ({ createEmployeeCreationService: () => ({ list: h.creation }) }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (defaults: Record<string, string>) => defaults, getRequestLocale: () => 'en' }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('./content/content-client', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: 'a' }));
const grant = (role: 'content_contributor' | 'pricing_editor' | 'booking_mode_editor') => ({
  id: 'grant-' + role, parentGrantId: null, parentGrant: null, canDelegate: false, expiresAt: null, role, identityId: 'employee', status: 'active', scopeType: 'unit', projectId: 'project-a', unitId: 'unit-a',
  organizationId: null, providerId: null, unit: { projectId: 'project-a' },
});
const show = async () => render(await PropertyWorkspaceNav({ identityId: 'employee', current: 'content' }));

beforeEach(() => {
  vi.clearAllMocks(); h.creation.mockResolvedValue({ spaces: [], items: [] }); h.actor.mockResolvedValue({ status: 'active', isAdmin: false }); h.roles.mockResolvedValue([]);
});
describe('independent employee workspace navigation', () => {
  it.each(['content_contributor', 'pricing_editor', 'booking_mode_editor'] as const)('shows only the separately assigned %s workspace', async role => {
    h.roles.mockResolvedValue([grant(role)]); await show();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', role === 'content_contributor' ? '/property/content' : role === 'pricing_editor' ? '/property/pricing' : '/property/booking-mode');
  });
  it('retains both independently assigned destinations', async () => {
    h.roles.mockResolvedValue([grant('content_contributor'), grant('pricing_editor')]); await show();
    expect(screen.getByRole('link', { name: 'Descriptions and photos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Rates and stay rules' })).toHaveAttribute('href', '/property/pricing');
  });
  it.each([
    { scopeType: 'platform', projectId: null, unitId: null },
    { organizationId: 'org' }, { providerId: 'provider' }, { status: 'revoked' },
    { identityId: 'someone-else' }, { unit: { projectId: 'foreign-project' } },
  ])('hides invalid assignments: %j', async invalid => {
    h.roles.mockResolvedValue([{ ...grant('pricing_editor'), ...invalid }]);
    expect(await PropertyWorkspaceNav({ identityId: 'employee', current: 'pricing' })).toBeNull();
  });
  it('hides all links immediately for a blocked identity', async () => {
    h.actor.mockResolvedValue({ status: 'blocked', isAdmin: true });
    expect(await PropertyWorkspaceNav({ identityId: 'employee', current: 'content' })).toBeNull();
    expect(h.roles).not.toHaveBeenCalled();
  });
  it('adds delegation only for a current root explicitly allowed to delegate', async () => {
    h.roles.mockResolvedValue([{ ...grant('pricing_editor'), canDelegate: true }]); await show();
    expect(screen.getByRole('link', { name: 'Delegate assigned rights' })).toHaveAttribute('href', '/property/access');
  });
  it('hides expired pricing while keeping independent content rights', async () => {
    h.roles.mockResolvedValue([grant('content_contributor'), { ...grant('pricing_editor'), expiresAt: new Date(0) }]); await show();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/property/content');
  });
  it.each(['blocked', 'invited'])('hides delegated capability when its manager is %s', async status => {
    const root = { ...grant('pricing_editor'), id: 'root', identityId: 'manager', canDelegate: true, identity: { status } };
    h.roles.mockResolvedValue([{ ...grant('pricing_editor'), parentGrantId: 'root', parentGrant: root, grantedByIdentityId: 'manager' }]);
    expect(await PropertyWorkspaceNav({ identityId: 'employee', current: 'pricing' })).toBeNull();
  });
  it('shows admin destinations without fabricating employee assignments', async () => {
    h.actor.mockResolvedValue({ status: 'active', isAdmin: true }); await show();
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});

describe('property content entry routing', () => {
  beforeEach(() => {
    h.user.mockResolvedValue({ identityId: 'employee' });
    h.redirect.mockImplementation((url: string) => { throw new Error('REDIRECT:' + url); });
  });
  it('routes an active admin to the existing canonical project editors', async () => {
    h.actor.mockResolvedValue({ status: 'active', isAdmin: true });
    await expect(PropertyContentPage({})).rejects.toThrow('REDIRECT:/app/admin/projects');
  });
  it('keeps the scoped employee proposal editor', async () => {
    const page = await PropertyContentPage({});
    expect(page).toBeTruthy();
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it('does not route a blocked identity into admin editors', async () => {
    h.actor.mockResolvedValue({ status: 'blocked', isAdmin: true });
    await PropertyContentPage({});
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it('preserves explicit target and proposal deep links', async () => {
    h.actor.mockResolvedValue({ status: 'active', isAdmin: true });
    const page = await PropertyContentPage({ searchParams: { scope: 'unit', targetId: 'unit-a', proposalId: 'proposal-a' } });
    expect(page.props.children[1].props.initialTarget).toEqual({ scope: 'unit', id: 'unit-a' });
    expect(page.props.children[1].props.initialProposalId).toBe('proposal-a');
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it('preserves login return context for a signed-out visitor', async () => {
    h.user.mockResolvedValue(null);
    await expect(PropertyContentPage({ searchParams: { scope: 'unit', targetId: 'unit-a' } }))
      .rejects.toThrow('REDIRECT:/login?next=');
    expect(h.actor).not.toHaveBeenCalled();
  });
});
