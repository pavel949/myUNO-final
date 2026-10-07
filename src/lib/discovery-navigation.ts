const SEARCH_KEYS = ['startDate', 'endDate', 'adults', 'children', 'projectId', 'areaSlug', 'stayMode', 'inventoryCategoryId', 'bedrooms', 'unitTypes', 'minPrice', 'maxPrice', 'sort', 'swLat', 'swLng', 'neLat', 'neLng'] as const;
export function discoveryContext(input: Record<string, string | string[] | undefined> = {}, overrides: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) query.set(key, value);
  return query.toString();
}
