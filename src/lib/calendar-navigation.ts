import { validCalendarDay } from '@/modules/booking/calendar-projection';

const BOARD_PATH = '/ops/calendar/board';

/** Restore board filters only; task/workspace authorization stays with the pages. */
export function taskCalendarReturnHref(
  returnTo: unknown,
  scope: { spaceId?: string; unitId?: string; mc?: boolean },
): string {
  const params = new URLSearchParams();
  if (scope.spaceId) params.set('spaceId', scope.spaceId);
  const isBoardReturn = typeof returnTo === 'string' && returnTo.length <= 4096 &&
    !returnTo.includes('#') && returnTo.split('?')[0] === BOARD_PATH;
  if (!isBoardReturn && scope.unitId) params.set('unitId', scope.unitId);
  if (scope.mc) params.set('mc', '1');

  if (isBoardReturn) {
    const source = new URLSearchParams(returnTo.slice(BOARD_PATH.length + 1));
    for (const key of ['projectId', 'organizationId', 'categoryId', 'unitId', 'start', 'days'] as const) {
      const values = source.getAll(key);
      if (values.length !== 1 || !values[0]) continue;
      const value = values[0];
      if (key === 'start' && !validCalendarDay(value)) continue;
      if (key === 'days' && !['7', '14', '30'].includes(value)) continue;
      params.set(key, value);
    }
  }

  // Never use the supplied path, unknown parameters, or supplied workspace/MC scope.
  return BOARD_PATH + (params.size ? '?' + params.toString() : '');
}
