import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyWorkspaceNav from './workspace-nav';
import PropertyWorkspacePage from './page';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
const h = vi.hoisted(() => ({ workspaces: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (defaults: Record<string, string>) => defaults }));
vi.mock('@/modules/core/property-workspaces', () => ({ getPropertyWorkspaces: h.workspaces }));
vi.mock('@/modules/onboarding/employee-creation.service', () => ({ createEmployeeCreationService: () => ({ list: h.list }) }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'creator-a' }) }));
beforeEach(() => { vi.clearAllMocks(); h.workspaces.mockResolvedValue([]); h.list.mockResolvedValue({ spaces: [], items: [] }); });
afterEach(cleanup);
async function nav() { return PropertyWorkspaceNav({ identityId: 'creator-a', current: 'create' }); }

describe('queued creation entry preserving authority V2 navigation', () => {
  it('shows creation-only authorized employees an entry in both nav and workspace hub', async () => {
    h.list.mockResolvedValue({ spaces: [{ id: 'space-a' }], items: [] });
    render(await nav());
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Create a property draft' })).toHaveAttribute('href', '/property/create');
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
    cleanup(); render(await PropertyWorkspacePage());
    expect(screen.getByRole('heading', { name: 'Create a property draft' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/property/create');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('retains the entry for an active revoked creator with only their historical intake', async () => {
    h.list.mockResolvedValue({ spaces: [], items: [{ id: 'own-old-draft', hasCreationAccess: false }] });
    render(await nav()); expect(screen.getByRole('link')).toHaveAttribute('href', '/property/create');
    cleanup(); render(await PropertyWorkspacePage()); expect(screen.getByRole('link')).toHaveAttribute('href', '/property/create');
  });
  it('hides the entry when no creation grant or creator-owned intake exists', async () => {
    expect(await nav()).toBeNull();
    render(await PropertyWorkspacePage());
    expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('hides creation when the service rejects a disabled identity', async () => {
    h.list.mockRejectedValue(new EmployeeCreationError(403, 'Inactive identity'));
    expect(await nav()).toBeNull();
    render(await PropertyWorkspacePage()); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('preserves V2 content and pricing links alongside independently authorized creation', async () => {
    h.workspaces.mockResolvedValue(['content', 'pricing']);
    h.list.mockResolvedValue({ spaces: [{ id: 'space-a' }], items: [] });
    render(await PropertyWorkspaceNav({ identityId: 'creator-a', current: 'content' }));
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Descriptions and photos' })).toHaveAttribute('href', '/property/content');
    expect(screen.getByRole('link', { name: 'Descriptions and photos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Rates and stay rules' })).toHaveAttribute('href', '/property/pricing');
    expect(screen.getByRole('link', { name: 'Create a property draft' })).not.toHaveAttribute('aria-current');
  });
  it('does not turn an unexpected data error into a misleading empty workspace', async () => {
    h.list.mockRejectedValue(new Error('Unavailable store'));
    await expect(nav()).rejects.toThrow('Unavailable store');
    await expect(PropertyWorkspacePage()).rejects.toThrow('Unavailable store');
  });
});
