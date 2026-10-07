// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { McWorkspaceShell } from './McWorkspaceShell';
let query = '';
vi.mock('next/navigation', () => ({ usePathname: () => '/mc', useSearchParams: () => new URLSearchParams(query) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => <a href={href} {...props}>{children}</a> }));
afterEach(cleanup);
describe('management workspace navigation', () => {
  it('preserves project and organization when opening a different workspace section', () => {
    query = 'projectId=project-a&organizationId=mandate-a';
    render(<McWorkspaceShell title="PMS" items={[{ href: '/mc/calendar', label: 'Calendar' }, { href: '/mc#managed-properties', label: 'Portfolio' }]}><p>Content</p></McWorkspaceShell>);
    expect(screen.getAllByRole('link', { name: 'Calendar' })[0].getAttribute('href')).toBe('/mc/calendar?projectId=project-a&organizationId=mandate-a');
    expect(screen.getAllByRole('link', { name: 'Portfolio' })[0].getAttribute('href')).toBe('/mc?projectId=project-a&organizationId=mandate-a#managed-properties');
  });
  it('retains explicit link scope and never forwards unrelated filters', () => {
    query = 'projectId=project-a&organizationId=mandate-a&guestIdentityId=private&start=2026-10-08';
    render(<McWorkspaceShell title="PMS" items={[{ href: '/mc/costs?projectId=project-b', label: 'Costs' }, { href: '/ops/tasks?mc=1', label: 'Tasks' }]}><p>Content</p></McWorkspaceShell>);
    expect(screen.getAllByRole('link', { name: 'Costs' })[0].getAttribute('href')).toBe('/mc/costs?projectId=project-b&organizationId=mandate-a');
    expect(screen.getAllByRole('link', { name: 'Tasks' })[0].getAttribute('href')).toBe('/ops/tasks?mc=1');
  });
});
