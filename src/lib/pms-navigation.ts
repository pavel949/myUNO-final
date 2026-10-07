/** Navigation context is a filter, never an authorization grant. */
export interface PmsNavigationContext { spaceId?: string; projectId?: string }
const SPACE_VIEWS = new Set(['housekeeping', 'maintenance', 'reservations']);
export function pmsWorkspaceSelectionHref(view: string, spaceId: string): string {
  return SPACE_VIEWS.has(view)
    ? `/ops/${view}?${new URLSearchParams({ spaceId })}`
    : `/ops/spaces/${encodeURIComponent(spaceId)}`;
}
export function pmsNavigationHref(href: string, context: PmsNavigationContext): string {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  const { spaceId, projectId } = context;
  if (path === '/ops' && spaceId) return `/ops/spaces/${encodeURIComponent(spaceId)}`;
  if (path === '/ops/housekeeping' || path === '/ops/maintenance') {
    if (!spaceId) return `/ops/spaces?${new URLSearchParams({ view: path.split('/').pop()! })}`;
  }
  if (spaceId && ['/ops/calendar/board', '/ops/calendar', '/ops/stays', '/ops/tasks', '/ops/housekeeping', '/ops/maintenance', '/ops/reservations'].includes(path)) {
    params.set('spaceId', spaceId);
  }
  if (projectId && ['/ops/calendar/board', '/ops/calendar', '/ops/stays', '/ops/requests', '/ops/night-audit'].includes(path)) {
    params.set('projectId', projectId);
  }
  return path + (params.size ? '?' + params.toString() : '');
}
