export type StaySearchContext = {
  startDate?: string | null;
  endDate?: string | null;
  adults?: string | number | null;
  children?: string | number | null;
  projectId?: string | null;
  areaSlug?: string | null;
  stayMode?: string | null;
};

export type StayServiceContext = {
  bookingId?: string | null;
  projectId?: string | null;
  unitId?: string | null;
  category?: string | null;
};

function setIf(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value !== null && value !== undefined && String(value) !== '') {
    params.set(key, String(value));
  }
}

/** Stable URL contract: Project Space -> search -> unit -> review. */
export function staySearchParams(context: StaySearchContext): URLSearchParams {
  const params = new URLSearchParams();
  setIf(params, 'startDate', context.startDate);
  setIf(params, 'endDate', context.endDate);
  setIf(params, 'adults', context.adults);
  setIf(params, 'children', context.children);
  setIf(params, 'projectId', context.projectId);
  setIf(params, 'areaSlug', context.areaSlug);
  setIf(params, 'stayMode', context.stayMode);
  return params;
}

/** Stable URL contract: Project/Home Space -> marketplace -> service detail. */
export function stayServiceParams(context: StayServiceContext): URLSearchParams {
  const params = new URLSearchParams();
  setIf(params, 'bookingId', context.bookingId);
  setIf(params, 'projectId', context.projectId);
  setIf(params, 'unitId', context.unitId);
  setIf(params, 'category', context.category);
  return params;
}

export function bookingHomeSpaceHref(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/home-space`;
}
