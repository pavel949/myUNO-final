import { taskCalendarReturnHref } from './calendar-navigation';

/** Navigation is a projection of current server authority, never an authority grant. */
export type WorkspaceMode = 'personal' | 'property' | 'services';
export interface WorkspaceLink { href: string; labelKey: string }
export interface WorkspaceScope {
  projectIds: string[]; organizationIds: string[]; spaceIds: string[]; unitIds: string[];
}
export interface WorkspaceOption {
  id: string; labelKey: string; href: string; scopeName?: string;
  todayHref: string | null; calendarHref: string | null; propertiesHref: string;
  more: WorkspaceLink[]; scope: WorkspaceScope; calendarScope?: WorkspaceScope; taskSpaceIds?: string[];
}
export interface WorkspaceNavigationContext {
  identityKey: string | null; signedIn: boolean;
  propertyOptions: WorkspaceOption[]; serviceOptions: WorkspaceOption[];
  controlPlane: WorkspaceLink | null; personalLinks: WorkspaceLink[];
}
export interface WorkspaceTab {
  id: string; labelKey: string; href: string | null;
  unavailableReason?: 'not_authorized' | 'not_available'; nextHref?: string;
}
export interface WorkspaceNavigationSelection {
  pathname: string; search?: string;
  preferredMode?: WorkspaceMode; preferredOptionId?: string;
}
export interface ResolvedWorkspaceNavigation {
  mode: WorkspaceMode; option: WorkspaceOption | null; controlPlane: boolean;
  tabs: WorkspaceTab[]; more: WorkspaceLink[]; availableModes: WorkspaceMode[];
}
export const WORKSPACE_NAVIGATION_LABEL_KEYS = [
  'workspace.navigation.explore', 'workspace.navigation.saved', 'workspace.navigation.my',
  'workspace.navigation.messages', 'workspace.navigation.profile', 'workspace.navigation.today',
  'workspace.navigation.calendar', 'workspace.navigation.properties', 'workspace.navigation.more',
  'workspace.navigation.orders', 'workspace.navigation.services', 'workspace.navigation.earnings',
] as const;

const under = (path: string, root: string) => path === root || path.startsWith(root + '/');
const localHref = (href: string) => href.startsWith('/') && !href.startsWith('//') && !/[\\\r\n]/.test(href);
const queryOf = (search = '') => new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
const one = (params: URLSearchParams, key: string) => params.getAll(key).length === 1 ? params.get(key) : null;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Copy recognized filters only, intersecting every authority-bearing ID with server scope. */
export function scopedWorkspaceHref(href: string, option: WorkspaceOption, search = '', mode: WorkspaceMode = 'property'): string {
  if (!localHref(href)) return option.href;
  const [target, fragment] = href.split('#');
  const [path, query = ''] = target.split('?');
  const source = queryOf(search);
  const nestedReturn = one(source, 'returnTo');
  if (nestedReturn) {
    const restored = taskCalendarReturnHref(nestedReturn, {
      spaceId: option.scope.spaceIds.includes(one(source, 'spaceId') || '') ? one(source, 'spaceId')! : undefined,
      mc: option.id.startsWith('mc:'),
    });
    const restoredParams = queryOf(restored.split('?')[1]);
    for (const [key, value] of Array.from(restoredParams.entries())) if (!source.has(key)) source.set(key, value);
  }
  const result = new URLSearchParams(query);
  const isCalendar = under(path, '/ops/calendar') || path === '/mc/calendar';
  const scope = isCalendar && option.calendarScope ? option.calendarScope : option.scope;
  const scopeKeys = { projectId: scope.projectIds, organizationId: scope.organizationIds, spaceId: scope.spaceIds, unitId: scope.unitIds };
  const isOps = under(path, '/ops');
  const isMc = under(path, '/mc');
  const shared = under(path, '/messages');
  if (isOps || isMc || shared || path === '/juristic') {
    for (const [key, allowed] of Object.entries(scopeKeys)) {
      if (key === 'organizationId' && isOps && !option.id.startsWith('mc:')) { result.delete(key); continue; }
      // Even pre-existing link parameters must stay within current server authority.
      if (result.has(key)) {
        const pinned = one(result, key);
        if (pinned && allowed.includes(pinned)) continue;
        result.delete(key);
      }
      const value = one(source, key);
      if (value && allowed.includes(value)) result.set(key, value);
      else if (allowed.length === 1 && (key !== 'unitId' || isCalendar) && (key !== 'spaceId' || option.id.startsWith('space:'))) result.set(key, allowed[0]);
    }
  }
  if (isCalendar) {
    const start = one(source, 'start');
    if (start && validDate(start) && !result.has('start')) result.set('start', start);
    const days = one(source, 'days');
    if (days && ['7', '14', '30'].includes(days) && !result.has('days')) result.set('days', days);
    // Category is a narrowing display filter; the destination validates its project relationship.
    const category = one(source, 'categoryId');
    if (category && /^[A-Za-z0-9_-]{1,200}$/.test(category) && !result.has('categoryId')) result.set('categoryId', category);
  }
  if (option.id.startsWith('mc:') && (isOps || isMc)) result.set('mc', '1');
  if (path === '/ops/tasks') {
    const hasBoardFilters = ['start', 'days', 'categoryId', 'unitId'].some(key => source.has(key));
    if (hasBoardFilters || nestedReturn) {
      const board = scopedWorkspaceHref('/ops/calendar/board', option, source.toString().replace(/(^|&)returnTo=[^&]*/g, ''), mode);
      result.set('returnTo', taskCalendarReturnHref(board, { spaceId: result.get('spaceId') || undefined, mc: option.id.startsWith('mc:') }));
    }
  }
  if (shared) { result.set('workspace', mode); result.set('workspaceOption', option.id); }
  return path + (result.size ? '?' + result.toString() : '') + (fragment ? '#' + fragment : '');
}

function routeOption(options: WorkspaceOption[], path: string, query: URLSearchParams): WorkspaceOption | undefined {
  const mc = under(path, '/mc') || (under(path, '/ops') && (one(query, 'mc') === '1' || Boolean(one(query, 'organizationId'))));
  if (mc) {
    const choices = options.filter(option => option.id.startsWith('mc:'));
    return choices.find(option => option.scope.projectIds.includes(one(query, 'projectId') || '') &&
      (!one(query, 'organizationId') || option.scope.organizationIds.includes(one(query, 'organizationId')!))) || choices[0];
  }
  const space = one(query, 'spaceId') || (under(path, '/ops/spaces') ? decodeSafe(path.split('/')[3] || '') : null);
  if (space) {
    const match = options.find(option => option.id.startsWith('space:') && option.scope.spaceIds.includes(space));
    if (match) return match;
  }
  if (under(path, '/ops')) return options.find(option => option.id === 'ops');
  if (under(path, '/owner')) return options.find(option => option.id === 'owner');
  if (path === '/residence') return options.find(option => option.id === 'residence');
  if (path === '/juristic') return options.find(option => option.id === 'juristic');
  if (under(path, '/property/create')) return options.find(option => option.id === 'creation');
  if (path === '/property') return options.find(option => option.id === 'property') || options.find(option => option.id === 'creation');
  if (under(path, '/property')) return options.find(option => option.id === 'property' && option.more.some(link => under(path, link.href.split(/[?#]/)[0])));
  if (under(path, '/provider')) return options[0];
  return undefined;
}
function decodeSafe(value: string): string { try { return decodeURIComponent(value); } catch { return ''; } }

export function resolveWorkspaceNavigation(context: WorkspaceNavigationContext, input: WorkspaceNavigationSelection): ResolvedWorkspaceNavigation {
  const path = input.pathname || '/';
  const query = queryOf(input.search);
  const availableModes: WorkspaceMode[] = ['personal',
    ...(context.propertyOptions.length ? ['property' as const] : []),
    ...(context.serviceOptions.length ? ['services' as const] : [])];
  // Control-plane routing is explicit and can never be restored from local storage.
  if (under(path, '/app/admin') || under(path, '/admin')) return {
    mode: 'property', option: null, controlPlane: true, tabs: [],
    more: context.controlPlane ? [context.controlPlane] : [], availableModes,
  };
  const isPropertyRoute = !under(path, '/property/onboard') && !under(path, '/property/listings') &&
    ['/ops', '/mc', '/owner', '/property', '/juristic', '/residence'].some(root => under(path, root));
  const isProviderRoute = under(path, '/provider') && path !== '/provider/apply';
  const shared = ['/messages', '/tickets', '/announcements'].some(root => under(path, root));
  // Discovery, personal trips and account pages do not inherit a previous work preference.
  const explicit = one(query, 'workspace');
  const requestedMode = explicit === 'personal' || explicit === 'property' || explicit === 'services'
    ? explicit : shared ? input.preferredMode : undefined;
  let mode: WorkspaceMode = isPropertyRoute && context.propertyOptions.length ? 'property' :
    isProviderRoute && context.serviceOptions.length ? 'services' :
      requestedMode && availableModes.includes(requestedMode) ? requestedMode : 'personal';
  const options = mode === 'property' ? context.propertyOptions : mode === 'services' ? context.serviceOptions : [];
  const optionId = one(query, 'workspaceOption') || input.preferredOptionId;
  const routeOwned = (mode === 'property' && isPropertyRoute) || (mode === 'services' && isProviderRoute);
  const unsupportedMcTasks = under(path, '/ops/tasks') && (one(query, 'mc') === '1' || Boolean(one(query, 'organizationId')));
  const routeMatch = routeOwned && !unsupportedMcTasks ? routeOption(options, path, query) : undefined;
  // A rejected or not-yet-authorized work URL never receives public discovery tabs
  // or an unrelated role's workflow while its destination guard resolves.
  if ((isPropertyRoute || isProviderRoute) && !routeMatch) return {
    mode: isProviderRoute ? 'services' : 'property', option: null, controlPlane: false,
    tabs: [], more: [], availableModes,
  };
  const option = routeMatch ||
    options.find(candidate => candidate.id === optionId) || options[0] || null;
  if (mode !== 'personal' && !option) mode = 'personal';
  const label = (id: string) => `workspace.navigation.${id}`;
  if (mode === 'personal') {
    const auth = (href: string) => context.signedIn ? href : '/login?next=' + encodeURIComponent(href);
    return { mode, option: null, controlPlane: false, availableModes, more: [], tabs: [
      { id: 'explore', labelKey: label('explore'), href: '/search' },
      { id: 'saved', labelKey: label('saved'), href: '/saved' },
      { id: 'my', labelKey: label('my'), href: auth('/app') },
      { id: 'messages', labelKey: label('messages'), href: auth('/messages?workspace=personal') },
      { id: 'profile', labelKey: label('profile'), href: auth('/account') },
    ] };
  }
  const selected = option!;
  const scoped = (href: string) => scopedWorkspaceHref(href, selected, input.search, mode);
  const currentSpace = one(query, 'spaceId');
  const mcSpace = selected.id.startsWith('mc:') && Boolean(currentSpace);
  const more = [...selected.more.filter(link => !mcSpace || !under(link.href.split(/[?#]/)[0], '/ops/tasks') || selected.taskSpaceIds?.includes(currentSpace!)), { href: '/account', labelKey: 'workspace.navigation.profile' },
    ...(context.controlPlane ? [context.controlPlane] : [])]
    .filter((link, index, links) => links.findIndex(item => item.href === link.href) === index)
    .map(link => ({ ...link, href: scoped(link.href) }));
  const nextHref = mcSpace && selected.calendarHref ? scoped(selected.calendarHref) : scoped(selected.propertiesHref);
  const tab = (id: string, href: string | null): WorkspaceTab => href
    ? { id, labelKey: label(id), href: scoped(href) }
    : { id, labelKey: label(id), href: null, unavailableReason: 'not_available', nextHref };
  const currentProject = one(query, 'projectId');
  const calendarPermitted = (!currentProject || !selected.calendarScope || selected.calendarScope.projectIds.includes(currentProject)) &&
    (!currentSpace || (selected.calendarScope || selected.scope).spaceIds.includes(currentSpace));
  let propertiesHref = selected.propertiesHref;
  if (selected.todayHref && selected.todayHref.split('#')[0] === propertiesHref.split('#')[0]) {
    const [target, fragment] = propertiesHref.split('#');
    propertiesHref = target + (target.includes('?') ? '&' : '?') + 'workspaceTab=properties' + (fragment ? '#' + fragment : '');
  }
  const tabs = mode === 'property' ? [
    tab('today', mcSpace ? null : selected.todayHref), tab('calendar', calendarPermitted ? selected.calendarHref : null),
    tab('properties', mcSpace ? null : propertiesHref), tab('messages', '/messages'),
    { id: 'more', labelKey: label('more'), href: null },
  ] : [tab('orders', selected.href), tab('services', selected.propertiesHref),
    tab('earnings', selected.more.find(link => link.href === '/provider/remittances')?.href || null),
    tab('messages', '/messages'), { id: 'more', labelKey: label('more'), href: null }];
  return { mode, option: selected, controlPlane: false, tabs, more, availableModes };
}

/** Stable selected-tab semantics even when a tab points at a workspace landing. */
export function isWorkspaceTabActive(tab: WorkspaceTab, navigation: ResolvedWorkspaceNavigation, pathname: string, search = ''): boolean {
  if (navigation.controlPlane) return false;
  if (navigation.mode === 'personal') {
    const personal = ['/app', '/trips', '/bookings', '/home', '/buying', '/residence', '/services/orders', '/property/onboard', '/property/listings'];
    const active = under(pathname, '/messages') ? 'messages' : (under(pathname, '/account') || pathname === '/login') ? 'profile' :
      under(pathname, '/saved') ? 'saved' : personal.some(root => under(pathname, root)) ? 'my' : 'explore';
    return tab.id === active;
  }
  if (under(pathname, '/messages')) return tab.id === 'messages';
  if (under(pathname, '/ops/calendar') || pathname === '/mc/calendar') return tab.id === 'calendar';
  if (navigation.mode === 'services') return tab.id === (under(pathname, '/provider/services') ? 'services' : under(pathname, '/provider/remittances') ? 'earnings' : 'orders');
  const isMore = navigation.more.some(link => {
    const path = link.href.split(/[?#]/)[0];
    return path !== navigation.option?.href.split(/[?#]/)[0] && under(pathname, path);
  });
  if (isMore) return tab.id === 'more';
  const today = navigation.option?.todayHref?.split(/[?#]/)[0];
  if (today && pathname === today && !queryOf(search).has('workspaceTab')) return tab.id === 'today';
  return tab.id === 'properties';
}
