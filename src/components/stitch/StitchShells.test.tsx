// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StitchWorkspaceShell } from './StitchShells';
let path = '/ops/spaces/resort-a';
let query = '';
vi.mock('next/navigation', () => ({ usePathname: () => path, useSearchParams: () => new URLSearchParams(query) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => <a href={href} {...props}>{children}</a> }));
afterEach(cleanup);
describe('operational sidebar scope', () => {
  it('uses current workspace path and retains explicit project filter', () => {
    query = 'projectId=project-a';
    render(<StitchWorkspaceShell title="PMS" preservePmsContext items={[{ href: '/ops/housekeeping', label: 'Cleaning' }, { href: '/ops/calendar/board', label: 'Calendar' }]}><p>Content</p></StitchWorkspaceShell>);
    expect(screen.getAllByRole('link', { name: 'Cleaning' })[0].getAttribute('href')).toBe('/ops/housekeeping?spaceId=resort-a');
    expect(screen.getAllByRole('link', { name: 'Calendar' })[0].getAttribute('href')).toBe('/ops/calendar/board?spaceId=resort-a&projectId=project-a');
  });
  it('asks for scope instead of silently bouncing back from maintenance', () => {
    path = '/ops'; query = '';
    render(<StitchWorkspaceShell title="PMS" preservePmsContext items={[{ href: '/ops/maintenance', label: 'Maintenance' }]}><p>Content</p></StitchWorkspaceShell>);
    expect(screen.getAllByRole('link', { name: 'Maintenance' })[0].getAttribute('href')).toBe('/ops/spaces?view=maintenance');
  });
});
