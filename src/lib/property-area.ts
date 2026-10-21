/** A display choice, never a write or a conversion between area definitions. */
export function propertyHeadlineArea(unit: {
  grossAreaSqm?: number | string | null;
  sizeSqm?: number | null;
}): number | null {
  const value = unit.grossAreaSqm ?? unit.sizeSqm;
  if (value == null) return null;
  const area = Number(value);
  return Number.isFinite(area) && area > 0 ? area : null;
}
