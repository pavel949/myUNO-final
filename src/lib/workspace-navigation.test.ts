import { describe, expect, it } from 'vitest';
import { isWorkspaceTabActive, resolveWorkspaceNavigation, scopedWorkspaceHref, type WorkspaceNavigationContext, type WorkspaceOption } from './workspace-navigation';

const scope = { projectIds: ['p'], organizationIds: [], spaceIds: [], unitIds: [] };
const ops: WorkspaceOption = { id: 'ops', labelKey: 'ops', href: '/ops', todayHref: '/ops', calendarHref: '/ops/calendar/board',
  propertiesHref: '/ops/spaces', more: [{ href: '/ops/tasks', labelKey: 'tasks' }], scope };
const owner: WorkspaceOption = { ...ops, id: 'owner', href: '/owner', todayHref: '/owner', calendarHref: null, propertiesHref: '/owner', more: [] };
const creation: WorkspaceOption = { ...ops, id: 'creation', href: '/property/create', todayHref: null, calendarHref: null, propertiesHref: '/property/create', more: [] };
const provider: WorkspaceOption = { ...ops, id: 'provider:pr', href: '/provider', todayHref: '/provider', propertiesHref: '/provider/services', more: [{ href: '/provider/remittances', labelKey: 'remittances' }] };
const context: WorkspaceNavigationContext = { identityKey: 'u', signedIn: true, propertyOptions: [ops, owner], serviceOptions: [], personalLinks: [], controlPlane: null };
const resolve = (pathname: string, extras = {}) => resolveWorkspaceNavigation(context, { pathname, ...extras });

describe('server-bounded workspace selection', () => {
  it('keeps the five personal jobs and distinct Profile', () => {
    expect(resolve('/').tabs.map(tab => tab.href)).toEqual(['/search', '/saved', '/app', '/messages?workspace=personal', '/account']);
  });
  it.each(['/projects', '/projects/complex', '/units/u', '/search', '/homes', '/trips/b', '/bookings/b/home-space', '/account'])('ignores stored work preference on %s', pathname => {
    expect(resolve(pathname, { preferredMode: 'property', preferredOptionId: 'ops' }).mode).toBe('personal');
  });
  it('supports an explicit valid public-page workspace choice', () => {
    expect(resolve('/projects/p', { search: 'workspace=property&workspaceOption=owner' }).option?.id).toBe('owner');
  });
  it('does not grant services from a URL or saved preference', () => {
    expect(resolve('/messages', { search: 'workspace=services', preferredMode: 'services' }).mode).toBe('personal');
  });
  it('allows owner explicit mode despite personal active-stay link', () => {
    const result = resolveWorkspaceNavigation({ ...context, personalLinks: [{ href: '/bookings/b/home-space', labelKey: 'stay' }] }, { pathname: '/owner', preferredMode: 'personal' });
    expect(result.option?.id).toBe('owner');
    expect(result.tabs.find(tab => tab.id === 'calendar')).toMatchObject({ href: null, nextHref: '/owner', unavailableReason: 'not_available' });
  });
  it('does not select control plane from saved storage', () => {
    expect(resolveWorkspaceNavigation({ ...context, controlPlane: { href: '/app/admin', labelKey: 'admin' } }, { pathname: '/app', preferredMode: 'property', preferredOptionId: 'admin' }).mode).toBe('personal');
  });
  it.each(['/app/admin', '/app/admin/projects/p', '/admin/finance/reconciliation'])('suppresses public tabs in %s', pathname => {
    expect(resolve(pathname)).toMatchObject({ controlPlane: true, tabs: [] });
  });
  it('keeps a valid selection on shared Messages and ignores invalid option IDs', () => {
    expect(resolve('/messages/t', { preferredMode: 'property', preferredOptionId: 'owner' }).option?.id).toBe('owner');
    expect(resolve('/messages', { preferredMode: 'property', preferredOptionId: 'forged' }).option?.id).toBe('ops');
  });
  it('creation-only has real Objects/Messages/More and truthful unavailable Today/Calendar', () => {
    const result = resolveWorkspaceNavigation({ ...context, propertyOptions: [creation] }, { pathname: '/property/create' });
    expect(result.tabs.map(tab => tab.id)).toEqual(['today', 'calendar', 'properties', 'messages', 'more']);
    expect(result.tabs.filter(tab => tab.unavailableReason)).toHaveLength(2);
    expect(result.tabs.find(tab => tab.id === 'properties')?.href).toBe('/property/create');
  });
  it('provider services uses only real provider routes', () => {
    const result = resolveWorkspaceNavigation({ ...context, serviceOptions: [provider] }, { pathname: '/provider' });
    expect(result.mode).toBe('services');
    expect(result.tabs.slice(0, 3).map(tab => tab.href)).toEqual(['/provider', '/provider/services', '/provider/remittances']);
  });
  it('anonymous protected tabs retain login return targets', () => {
    const result = resolveWorkspaceNavigation({ ...context, signedIn: false, identityKey: null, propertyOptions: [] }, { pathname: '/' });
    expect(result.tabs.find(tab => tab.id === 'my')?.href).toBe('/login?next=%2Fapp');
    expect(result.tabs.find(tab => tab.id === 'profile')?.href).toBe('/login?next=%2Faccount');
  });
});

describe('scope and back-navigation preservation', () => {
  it('preserves permitted calendar filters and rejects injected scope', () => {
    const href = scopedWorkspaceHref('/ops/calendar/board', ops, 'projectId=foreign&spaceId=foreign&organizationId=foreign&start=2026-10-15&days=14&categoryId=c&unknown=x');
    expect(href).toBe('/ops/calendar/board?projectId=p&start=2026-10-15&days=14&categoryId=c');
  });
  it('does not switch staff to MC mode by leaking the organization scope', () => {
    const space = { ...ops, id: 'space:s', scope: { ...scope, spaceIds: ['s'], organizationIds: ['org'] } };
    const href = scopedWorkspaceHref('/ops/calendar/board?spaceId=s', space, 'organizationId=org');
    expect(href).not.toContain('organizationId');
    expect(href).not.toContain('mc=');
  });
  it('preserves MC boundary through shared ops calendar and messages', () => {
    const mc = { ...ops, id: 'mc:p:org', scope: { ...scope, organizationIds: ['org'] } };
    expect(scopedWorkspaceHref('/ops/calendar/board', mc, 'projectId=p&organizationId=org')).toContain('mc=1');
    expect(scopedWorkspaceHref('/messages', mc)).toContain('workspace=property&workspaceOption=mc%3Ap%3Aorg');
  });
  it('does not enable calendar for a selected finance-only project', () => {
    const restricted = { ...ops, scope: { ...scope, projectIds: ['p', 'finance'] }, calendarScope: scope };
    const result = resolveWorkspaceNavigation({ ...context, propertyOptions: [restricted] }, { pathname: '/ops', search: 'projectId=finance' });
    expect(result.tabs.find(tab => tab.id === 'calendar')?.href).toBeNull();
  });
  it('rejects duplicate/malformed filter values and preserves target fragments', () => {
    expect(scopedWorkspaceHref('/ops/calendar/board#board', ops, 'start=2026-02-31&days=365&projectId=p&projectId=other')).toBe('/ops/calendar/board?projectId=p#board');
  });
  it('ignores a forged operating-space choice', () => {
    expect(resolve('/ops/calendar/board', { search: 'spaceId=forged' }).option?.id).toBe('ops');
  });
  it('marks public exploration and personal journeys consistently', () => {
    for (const [path, id] of [['/projects/p', 'explore'], ['/trips/b', 'my'], ['/account', 'profile'], ['/messages/t', 'messages']]) {
      const result = resolve(path);
      expect(result.tabs.filter(tab => isWorkspaceTabActive(tab, result, path)).map(tab => tab.id)).toEqual([id]);
    }
  });
});

it('keeps ordinary property submission journeys personal', () => {
  expect(resolve('/property/onboard', { preferredMode: 'property' }).mode).toBe('personal');
  expect(resolve('/property/listings', { preferredMode: 'property' }).mode).toBe('personal');
});
it('marks a same-route Properties selection explicitly', () => {
  const navigation = resolve('/owner');
  const href = navigation.tabs.find(tab => tab.id === 'properties')!.href!;
  expect(href).toContain('workspaceTab=properties');
  expect(isWorkspaceTabActive(navigation.tabs.find(tab => tab.id === 'properties')!, navigation, '/owner', href.split('?')[1])).toBe(true);
});
it('preserves bounded calendar return filters through More to Tasks and back', () => {
  const href = scopedWorkspaceHref('/ops/tasks', ops, 'projectId=p&start=2026-10-15&days=14&categoryId=c');
  const taskQuery = href.split('?')[1];
  const returned = scopedWorkspaceHref('/ops/calendar/board', ops, taskQuery);
  expect(returned).toBe('/ops/calendar/board?projectId=p&start=2026-10-15&days=14&categoryId=c');
  expect(href).toContain('returnTo=');
  expect(scopedWorkspaceHref('/ops/calendar/board', ops, 'returnTo=https%3A%2F%2Fevil.test%2F%3FprojectId%3Dforeign')).toBe('/ops/calendar/board?projectId=p');
});
it('validates even pinned target query scope', () => {
  expect(scopedWorkspaceHref('/messages/t?projectId=foreign&spaceId=foreign', ops)).toBe('/messages/t?projectId=p&workspace=property&workspaceOption=ops');
});
it('More never opens an empty sheet and admin is an explicit link only', () => {
  const result = resolveWorkspaceNavigation({ ...context, controlPlane: { href: '/app/admin', labelKey: 'admin' } }, { pathname: '/owner' });
  expect(result.more.map(link => link.href)).toEqual(['/account', '/app/admin']);
});
it('unauthorized work paths show only the switcher, never personal tabs or unrelated creation links', () => {
  const noWork = { ...context, propertyOptions: [] };
  expect(resolveWorkspaceNavigation(noWork, { pathname: '/ops' }).tabs).toEqual([]);
  expect(resolveWorkspaceNavigation({ ...context, propertyOptions: [creation] }, { pathname: '/ops/calendar/board' }).tabs).toEqual([]);
  expect(resolveWorkspaceNavigation(context, { pathname: '/provider' }).tabs).toEqual([]);
});
it('keeps explicit MC authority even when a dual-role operating space is selected', () => {
  const mc: WorkspaceOption = { ...ops, id: 'mc:p:org', href: '/mc?projectId=p&organizationId=org',
    todayHref: '/mc?projectId=p&organizationId=org', propertiesHref: '/mc?projectId=p&organizationId=org#managed-properties',
    scope: { ...scope, spaceIds: ['s'], organizationIds: ['org'] }, taskSpaceIds: ['s'] };
  const space = { ...ops, id: 'space:s', href: '/ops/spaces/s', scope: { ...scope, spaceIds: ['s'], organizationIds: ['org'] } };
  const navigation = resolveWorkspaceNavigation({ ...context, propertyOptions: [ops, space, mc] }, {
    pathname: '/ops/calendar/board', search: 'mc=1&spaceId=s&projectId=p&organizationId=org&start=2026-10-15&days=14',
  });
  expect(navigation.option?.id).toBe('mc:p:org');
  const calendar = navigation.tabs.find(tab => tab.id === 'calendar')!;
  expect(calendar.href).toContain('spaceId=s');
  expect(calendar.href).toContain('mc=1');
  expect(navigation.tabs.find(tab => tab.id === 'today')?.href).toBeNull();
  expect(navigation.tabs.find(tab => tab.id === 'properties')?.href).toBeNull();
  expect(navigation.more.find(link => link.href.startsWith('/ops/tasks'))?.href).toContain('mc=1');
});

it('a personal Messages click overrides a stored property preference', () => {
  expect(resolve('/messages', { search: 'workspace=personal', preferredMode: 'property', preferredOptionId: 'owner' }).mode).toBe('personal');
});
it('does not claim the aggregate MC task reader honors one selected portfolio', () => {
  const mc = { ...ops, id: 'mc:p:o' };
  const result = resolveWorkspaceNavigation({ ...context, propertyOptions: [mc] }, { pathname: '/ops/tasks', search: 'mc=1&projectId=p&organizationId=o' });
  expect(result.tabs).toEqual([]);
});
