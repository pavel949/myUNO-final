/** Pure presentation scope: never mix portfolio-wide values with a selected project. */
export function scopeOwnerPortfolio<T extends {
  id: string;
  projectId: string;
  occupancyThisMonth: number;
  revenueThisMonth: number;
}>(units: T[], projectId: string | null) {
  const visibleUnits = projectId
    ? units.filter((unit) => unit.projectId === projectId)
    : units;
  return {
    units: visibleUnits,
    unitIds: new Set(visibleUnits.map((unit) => unit.id)),
    occupiedNights: visibleUnits.reduce((sum, unit) => sum + unit.occupancyThisMonth, 0),
    bookedRevenueThb: visibleUnits.reduce((sum, unit) => sum + unit.revenueThisMonth, 0),
  };
}
