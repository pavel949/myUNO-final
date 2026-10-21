/** Accept only the current unit's authorized workspace routes. */
export function unitEditorReturn(input: {
  unitId: string;
  requested?: string;
  selfListing: boolean;
  mc: boolean;
  staff: boolean;
  admin: boolean;
}): string {
  const id = encodeURIComponent(input.unitId);
  const listing = `/property/listings/${id}`;
  const calendar = `/ops/calendar/${id}`;
  const workspace = `/mc/properties/${id}`;
  if (input.selfListing) return listing;
  const allowed = [
    ...(input.mc ? [workspace] : []),
    ...(input.staff || input.admin ? [calendar] : []),
  ];
  if (
    input.requested &&
    allowed.some((path) => input.requested === path || input.requested?.startsWith(path + '?'))
  )
    return input.requested;
  return input.staff || input.admin ? calendar : workspace;
}
