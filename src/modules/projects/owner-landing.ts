/**
 * Owner portal entry path (doc 06 S7, T-033).
 *
 * Single-unit owners land on their unit dashboard directly — no portfolio chrome.
 * Portfolio owners use the combined `/owner` home with ProjectSwitcher.
 */
export function resolveOwnerPortalPath(
  shape: { isPortfolio: boolean },
  units: readonly { id: string }[]
): '/owner' | `/owner/units/${string}` {
  if (!shape.isPortfolio && units.length === 1) {
    return `/owner/units/${units[0].id}`;
  }
  return '/owner';
}

/**
 * Unit id for adaptive `/app` landing when the owner holds exactly one unit.
 */
export function singleOwnerUnitId(
  shape: { isPortfolio: boolean },
  units: readonly { id: string }[]
): string | null {
  if (!shape.isPortfolio && units.length === 1) {
    return units[0].id;
  }
  return null;
}
