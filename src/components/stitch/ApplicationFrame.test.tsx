import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplicationFrame } from './ApplicationFrame';
const state = vi.hoisted(() => ({ path: '/', value: null as null | { mode: string; controlPlane: boolean } }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/components/WorkspaceNavigation', () => ({ useOptionalWorkspaceNavigation: () => state.value }));
const view = () => render(<ApplicationFrame navigation={<div>Header</div>} workspaceSwitcher={<div>Choose workspace</div>}
  mobileNavigation={<div>Workspace tabs</div>} footer={<div>Public footer</div>}><main>Content</main></ApplicationFrame>);
describe('workspace frame composition', () => {
  beforeEach(() => { state.path = '/'; state.value = null; });
  it('keeps public discovery footer and switcher', () => {
    view(); expect(screen.getByText('Public footer')).toBeInTheDocument();
    expect(screen.getByText('Choose workspace')).toBeInTheDocument();
  });
  it.each(['/ops', '/property', '/property/create', '/juristic', '/app/admin', '/admin/people'])('never mixes public footer into %s', path => {
    state.path = path; view(); expect(screen.queryByText('Public footer')).not.toBeInTheDocument();
  });
  it('retains work chrome on the shared participant-authorized inbox', () => {
    state.path = '/messages'; state.value = { mode: 'property', controlPlane: false }; view();
    expect(screen.queryByText('Public footer')).not.toBeInTheDocument();
    expect(screen.getByText('Content').parentElement).toHaveClass('workspace-content-clearance');
  });
  it('does not reserve lower-tab space in the admin control plane', () => {
    state.path = '/app/admin'; state.value = { mode: 'personal', controlPlane: true }; view();
    expect(screen.getByText('Content').parentElement).not.toHaveClass('workspace-content-clearance');
  });
  it('keeps owner intake in personal discovery context', () => {
    state.path = '/property/onboard'; state.value = { mode: 'personal', controlPlane: false }; view();
    expect(screen.getByText('Public footer')).toBeInTheDocument();
  });
});
