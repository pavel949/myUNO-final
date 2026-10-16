import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceNavigationContext, WorkspaceOption } from '@/lib/workspace-navigation';
import {
  WorkspaceNavigationProvider,
  WorkspaceContextLink,
  WorkspaceSwitcher,
  WorkspaceTabs,
  useOptionalWorkspaceNavigation,
  workspaceSelectionStorageKey,
} from './WorkspaceNavigation';

const route = vi.hoisted(() => ({ pathname: '/search', search: '', push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ push: route.push, refresh: route.refresh }),
}));

const labels = {
  'workspace.navigation': 'Workspace navigation',
  'workspace.switcher': 'Choose workspace',
  'workspace.personal': 'Personal',
  'workspace.property': 'Property',
  'workspace.services': 'Services',
  'workspace.chooseProperty': 'Choose property workspace',
  'workspace.chooseServices': 'Choose service workspace',
  'workspace.close': 'Close',
  'workspace.notAuthorized': 'This action is not included in your current access.',
  'workspace.notAvailable': 'This workspace does not have this tool yet.',
  'workspace.nextStep': 'Open available properties',
  'workspace.navigation.explore': 'Explore',
  'workspace.navigation.saved': 'Saved',
  'workspace.navigation.my': 'My',
  'workspace.navigation.messages': 'Messages',
  'workspace.navigation.profile': 'Profile',
  'workspace.navigation.today': 'Today',
  'workspace.navigation.calendar': 'Calendar',
  'workspace.navigation.properties': 'Properties',
  'workspace.navigation.more': 'More',
  'workspace.navigation.orders': 'Orders',
  'workspace.navigation.services': 'Services',
  'workspace.navigation.earnings': 'Earnings',
  'nav.ops': 'Operations',
  'nav.provider_portal': 'Provider portal',
  'nav.owner_dashboard': 'My homes',
  'property.creation.title': 'Create a property',
  'nav.account': 'Account',
  'nav.tickets': 'Requests',
  'nav.admin': 'Administration',
};

const scope = { projectIds: ['project-a'], organizationIds: [], spaceIds: [], unitIds: [] };
const ops: WorkspaceOption = {
  id: 'ops', labelKey: 'nav.ops', href: '/ops', todayHref: '/ops', calendarHref: '/ops/calendar',
  propertiesHref: '/ops/projects', scope,
  more: [{ href: '/tickets', labelKey: 'nav.tickets' }, { href: '/account', labelKey: 'nav.account' }],
};
const creation: WorkspaceOption = {
  id: 'creation', labelKey: 'property.creation.title', href: '/property/create', todayHref: null, calendarHref: null,
  propertiesHref: '/property/create', scope: { projectIds: [], organizationIds: [], spaceIds: [], unitIds: [] },
  more: [{ href: '/account', labelKey: 'nav.account' }],
};
const provider: WorkspaceOption = {
  id: 'provider', labelKey: 'nav.provider_portal', href: '/provider', todayHref: '/provider', calendarHref: null,
  propertiesHref: '/provider/services', scope,
  more: [{ href: '/provider/remittances', labelKey: 'workspace.navigation.earnings' }],
};
const baseContext: WorkspaceNavigationContext = {
  identityKey: 'identity-a', signedIn: true, propertyOptions: [ops], serviceOptions: [], controlPlane: null, personalLinks: [],
};

function Shell({ context = baseContext }: { context?: WorkspaceNavigationContext }) {
  return <WorkspaceNavigationProvider context={context} labels={labels}>
    <WorkspaceSwitcher />
    <main><button type="button">Page action</button></main>
    <WorkspaceTabs />
  </WorkspaceNavigationProvider>;
}

function bottomNav() { return screen.getByRole('navigation', { name: 'Workspace navigation' }); }
function switcher() { return screen.getByRole('navigation', { name: 'Choose workspace' }); }
function save(mode: string, optionId?: string, identity = 'identity-a') {
  window.localStorage.setItem(workspaceSelectionStorageKey(identity), JSON.stringify({ mode, optionId }));
}

function ConversationShell({ threadHref = '/messages/thread-a' }: { threadHref?: string }) {
  return <WorkspaceNavigationProvider context={baseContext} labels={labels}>
    <WorkspaceSwitcher />
    <WorkspaceContextLink href={threadHref}>Open thread</WorkspaceContextLink>
    <WorkspaceContextLink href="/messages">Back to inbox</WorkspaceContextLink>
    <WorkspaceContextLink href="/search">Browse homes</WorkspaceContextLink>
    <WorkspaceTabs />
  </WorkspaceNavigationProvider>;
}

function visit(href: string) {
  const url = new URL(href, 'https://myuno.example');
  route.pathname = url.pathname;
  route.search = url.search;
}

describe('WorkspaceNavigation', () => {
  beforeEach(() => {
    route.pathname = '/search'; route.search = ''; route.push.mockReset(); route.refresh.mockReset();
    window.localStorage.clear();
  });

  it('shows the five personal tabs on public property cards despite a saved work preference', () => {
    save('property', 'ops');
    route.pathname = '/projects/real-project';
    render(<Shell />);
    expect(within(bottomNav()).getAllByRole('link').map((item) => item.textContent)).toEqual(['Explore', 'Saved', 'My', 'Messages', 'Profile']);
    expect(within(bottomNav()).getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(bottomNav()).queryByText('Today')).not.toBeInTheDocument();
  });

  it('persists a work choice but keeps Personal Messages personal after public browsing and refresh', () => {
    const result = render(<Shell />);
    fireEvent.click(within(switcher()).getByRole('button', { name: 'Property' }));
    expect(route.push).toHaveBeenCalledWith('/ops');
    expect(JSON.parse(window.localStorage.getItem(workspaceSelectionStorageKey('identity-a'))!)).toEqual({ mode: 'property', optionId: 'ops' });
    route.pathname = '/ops'; result.rerender(<Shell />);
    route.pathname = '/messages'; result.rerender(<Shell />);
    expect(within(bottomNav()).getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
    expect(within(bottomNav()).getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/ops/calendar?projectId=project-a');
    result.unmount();
    const refreshed = render(<Shell />);
    expect(within(switcher()).getByRole('button', { name: 'Property' })).toHaveAttribute('aria-pressed', 'true');
    route.pathname = '/search'; refreshed.rerender(<Shell />);
    expect(within(bottomNav()).getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    visit(within(bottomNav()).getByRole('link', { name: 'Messages' }).getAttribute('href')!);
    refreshed.rerender(<Shell />);
    expect(within(bottomNav()).queryByRole('link', { name: 'Today' })).not.toBeInTheDocument();
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
    refreshed.unmount(); render(<Shell />);
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('resolves shared Messages from validated URL hints even before a preference is stored', () => {
    route.pathname = '/messages/thread-a'; route.search = 'workspace=property&workspaceOption=ops&projectId=project-a';
    render(<Shell />);
    expect(within(switcher()).getByRole('button', { name: 'Property' })).toHaveAttribute('aria-pressed', 'true');
    const messages = within(bottomNav()).getByRole('link', { name: 'Messages' });
    expect(messages).toHaveAttribute('aria-current', 'page');
    expect(messages.getAttribute('href')).toContain('workspaceOption=ops');
  });

  it('retains direct-entry work context through inbox, thread and back without a stored preference', () => {
    route.pathname = '/ops';
    const result = render(<ConversationShell />);
    const inbox = within(bottomNav()).getByRole('link', { name: 'Messages' }).getAttribute('href')!;
    visit(inbox); result.rerender(<ConversationShell />);
    expect(within(switcher()).getByRole('button', { name: 'Property' })).toHaveAttribute('aria-pressed', 'true');
    const thread = screen.getByRole('link', { name: 'Open thread' }).getAttribute('href')!;
    expect(thread).toContain('workspace=property'); expect(thread).toContain('projectId=project-a');
    visit(thread); result.rerender(<ConversationShell />);
    expect(within(bottomNav()).getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');
    const back = screen.getByRole('link', { name: 'Back to inbox' }).getAttribute('href')!;
    expect(back).toContain('workspaceOption=ops');
    visit(back); result.rerender(<ConversationShell />);
    expect(within(switcher()).getByRole('button', { name: 'Property' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(workspaceSelectionStorageKey('identity-a'))).toBeNull();
    expect(screen.getByRole('link', { name: 'Browse homes' })).toHaveAttribute('href', '/search');
  });

  it('preserves explicit Personal through inbox, thread and back despite a stored Property preference', () => {
    save('property', 'ops'); route.pathname = '/projects/real-project';
    const result = render(<ConversationShell threadHref="/messages/thread-a?workspace=property&workspaceOption=ops&projectId=project-a&mc=1#latest" />);
    const inbox = within(bottomNav()).getByRole('link', { name: 'Messages' }).getAttribute('href')!;
    expect(inbox).toBe('/messages?workspace=personal');
    visit(inbox); result.rerender(<ConversationShell threadHref="/messages/thread-a?workspace=property&workspaceOption=ops&projectId=project-a&mc=1#latest" />);
    const thread = screen.getByRole('link', { name: 'Open thread' }).getAttribute('href')!;
    expect(thread).toBe('/messages/thread-a?workspace=personal#latest');
    visit(thread); result.rerender(<ConversationShell />);
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
    const back = screen.getByRole('link', { name: 'Back to inbox' }).getAttribute('href')!;
    expect(back).toBe('/messages?workspace=personal');
    visit(back); result.rerender(<ConversationShell />);
    expect(within(bottomNav()).getByRole('link', { name: 'My' })).toBeInTheDocument();
    expect(within(bottomNav()).queryByRole('link', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('does not carry tampered source scope into shared conversation links', () => {
    route.pathname = '/messages';
    route.search = 'workspace=property&workspaceOption=ops&projectId=foreign&spaceId=foreign-space&organizationId=foreign-org';
    render(<ConversationShell />);
    const href = screen.getByRole('link', { name: 'Open thread' }).getAttribute('href')!;
    expect(href).toContain('projectId=project-a');
    expect(href).not.toContain('foreign');
  });

  it('revalidates scope already present in the target conversation link', () => {
    route.pathname = '/ops';
    render(<ConversationShell threadHref="/messages/thread-a?projectId=foreign&organizationId=foreign-org&workspace=services&workspaceOption=forged" />);
    const href = screen.getByRole('link', { name: 'Open thread' }).getAttribute('href')!;
    expect(href).toContain('projectId=project-a');
    expect(href).toContain('workspace=property');
    expect(href).toContain('workspaceOption=ops');
    expect(href).not.toContain('foreign');
    expect(href).not.toContain('forged');
  });

  it('keeps standalone context links usable without a provider', () => {
    render(<WorkspaceContextLink href="/messages/thread-a">Open thread</WorkspaceContextLink>);
    expect(screen.getByRole('link', { name: 'Open thread' })).toHaveAttribute('href', '/messages/thread-a');
  });

  it('drops revoked saved options and immediately respects refreshed server authority', () => {
    route.pathname = '/messages'; save('property', 'ops');
    const result = render(<Shell />);
    expect(within(bottomNav()).getByRole('link', { name: 'Today' })).toBeInTheDocument();
    result.rerender(<Shell context={{ ...baseContext, propertyOptions: [] }} />);
    expect(within(switcher()).queryByRole('button', { name: 'Property' })).not.toBeInTheDocument();
    expect(within(bottomNav()).getByRole('link', { name: 'My' })).toBeInTheDocument();
    expect(window.localStorage.getItem(workspaceSelectionStorageKey('identity-a'))).toBeNull();
  });

  it('requests fresh server context after path changes and focus without refreshing on every render', () => {
    const result = render(<Shell />);
    expect(route.refresh).not.toHaveBeenCalled();
    result.rerender(<Shell />);
    expect(route.refresh).not.toHaveBeenCalled();
    route.pathname = '/messages'; result.rerender(<Shell />);
    expect(route.refresh).toHaveBeenCalledTimes(1);
    result.rerender(<Shell />);
    expect(route.refresh).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event('focus'));
    expect(route.refresh).toHaveBeenCalledTimes(2);
  });

  it('distinguishes two authorized workspaces with the same localized type', () => {
    route.pathname = '/ops';
    const first = { ...ops, id: 'mc:first', scopeName: 'Palm Residences · North team', href: '/mc?projectId=first' };
    const second = { ...ops, id: 'mc:second', scopeName: 'Bay Residences · South team', href: '/mc?projectId=second' };
    render(<Shell context={{ ...baseContext, propertyOptions: [first, second] }} />);
    const select = screen.getByRole('combobox', { name: 'Choose property workspace' });
    expect(within(select).getByRole('option', { name: 'Operations · Palm Residences · North team' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operations · Bay Residences · South team' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'mc:second' } });
    expect(route.push).toHaveBeenCalledWith('/mc?projectId=second');
  });

  it('never restores another identity’s workspace', () => {
    route.pathname = '/messages'; save('property', 'ops');
    const result = render(<Shell />);
    result.rerender(<Shell context={{ ...baseContext, identityKey: 'identity-b' }} />);
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not expose Services without a current provider option', () => {
    render(<Shell />);
    expect(within(switcher()).queryByRole('button', { name: 'Services' })).not.toBeInTheDocument();
  });

  it('uses only existing provider destinations and keeps Messages in Services', () => {
    route.pathname = '/provider/services';
    render(<Shell context={{ ...baseContext, serviceOptions: [provider] }} />);
    expect(within(switcher()).getByRole('button', { name: 'Services' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(bottomNav()).getByRole('link', { name: 'Services' })).toHaveAttribute('aria-current', 'page');
    expect(within(bottomNav()).getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/provider/remittances');
    expect(within(bottomNav()).getByRole('link', { name: 'Messages' }).getAttribute('href')).toContain('workspace=services');
  });

  it('keeps the explicit switch visible on admin pages without guest or work tabs', () => {
    route.pathname = '/app/admin/content';
    render(<Shell context={{ ...baseContext, controlPlane: { href: '/app/admin', labelKey: 'nav.admin' } }} />);
    expect(switcher()).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
    fireEvent.click(within(switcher()).getByRole('button', { name: 'Personal' }));
    expect(route.push).toHaveBeenCalledWith('/app');
  });

  it.each(['/ops', '/ops/calendar', '/owner', '/provider'])('shows only the switch, never fixed guest tabs, on denied %s', (pathname) => {
    route.pathname = pathname;
    render(<Shell context={{ ...baseContext, propertyOptions: [] }} />);
    expect(switcher()).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
  });

  it('does not substitute creation tabs for a denied operations route', () => {
    route.pathname = '/ops';
    render(<Shell context={{ ...baseContext, propertyOptions: [creation] }} />);
    expect(within(switcher()).getByRole('button', { name: 'Property' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  });

  it('keeps the admin alias switch-only as well', () => {
    route.pathname = '/admin/finance'; render(<Shell />);
    expect(switcher()).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  });

  it('gives creation-only users working Properties, Messages and More with an explained unavailable Calendar', () => {
    route.pathname = '/property/create';
    render(<Shell context={{ ...baseContext, propertyOptions: [creation] }} />);
    expect(within(bottomNav()).getByRole('link', { name: 'Properties' })).toHaveAttribute('href', '/property/create');
    expect(within(bottomNav()).getByRole('link', { name: 'Messages' }).getAttribute('href')).toContain('/messages?');
    fireEvent.click(within(bottomNav()).getByRole('button', { name: 'Calendar' }));
    const dialog = screen.getByRole('dialog', { name: 'Calendar' });
    expect(within(dialog).getByText(labels['workspace.notAvailable'])).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open available properties' })).toHaveAttribute('href', '/property/create');
  });

  it('makes More a labelled modal with focus trapping, Escape and focus restoration', async () => {
    const user = userEvent.setup(); route.pathname = '/ops';
    render(<Shell />);
    const more = within(bottomNav()).getByRole('button', { name: 'More' });
    await user.click(more);
    const dialog = screen.getByRole('dialog', { name: 'More' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('link', { name: 'Account' })).toHaveFocus();
    await user.tab(); expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the sheet when its close control or a destination is selected', () => {
    route.pathname = '/ops'; render(<Shell />);
    const more = within(bottomNav()).getByRole('button', { name: 'More' });
    fireEvent.click(more); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(more);
    const requests = within(screen.getByRole('dialog')).getByRole('link', { name: 'Requests' });
    requests.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(requests);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches among current server options without persisting scope data', () => {
    route.pathname = '/ops';
    render(<Shell context={{ ...baseContext, propertyOptions: [ops, creation] }} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose property workspace' }), { target: { value: 'creation' } });
    expect(route.push).toHaveBeenCalledWith('/property/create');
    expect(JSON.parse(window.localStorage.getItem(workspaceSelectionStorageKey('identity-a'))!)).toEqual({ mode: 'property', optionId: 'creation' });
  });

  it('keeps owner and guest views an explicit choice rather than inferring from a stay', () => {
    const owner: WorkspaceOption = { ...ops, id: 'owner', labelKey: 'nav.owner_dashboard', href: '/owner', todayHref: null, calendarHref: null, propertiesHref: '/owner' };
    save('property', 'owner'); route.pathname = '/home/active-stay';
    render(<Shell context={{ ...baseContext, propertyOptions: [owner] }} />);
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(switcher()).getByRole('button', { name: 'Property' }));
    expect(route.push).toHaveBeenCalledWith('/owner');
  });

  it('offers authenticated continuation for signed-out personal destinations', () => {
    render(<Shell context={{ ...baseContext, identityKey: null, signedIn: false, propertyOptions: [] }} />);
    expect(within(bottomNav()).getByRole('link', { name: 'My' })).toHaveAttribute('href', '/login?next=%2Fapp');
    expect(within(bottomNav()).getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/login?next=%2Fmessages%3Fworkspace%3Dpersonal');
  });

  it('uses 44px or larger targets and safe-area padding with frame-scoped measured offsets', () => {
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 88 } as DOMRect);
    const { container } = render(<Shell />);
    expect(within(switcher()).getByRole('button', { name: 'Personal' })).toHaveClass('min-h-44');
    expect(within(bottomNav()).getByRole('link', { name: 'Explore' })).toHaveClass('min-h-64');
    expect(bottomNav()).toHaveClass('pb-[env(safe-area-inset-bottom,0px)]');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--workspace-tab-height')).toBe('88px');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--workspace-switcher-height')).toBe('88px');
    bounds.mockRestore();
  });

  it('allows ApplicationFrame to be rendered safely outside the provider', () => {
    function OptionalConsumer() { return <span>{useOptionalWorkspaceNavigation() === null ? 'No context' : 'Has context'}</span>; }
    render(<OptionalConsumer />);
    expect(screen.getByText('No context')).toBeInTheDocument();
  });
});
