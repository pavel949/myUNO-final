/** Public filters refer only to recorded home amenities, never inferred location claims. */
export const STAY_AMENITY_KEYS = ['wifi', 'pool', 'kitchen', 'washer', 'workspace', 'kids_friendly', 'pets_allowed'] as const;
export type StayAmenityKey = typeof STAY_AMENITY_KEYS[number];
export function parseStayAmenities(value?: string | null): StayAmenityKey[] {
  return [...new Set((value || '').split(',').filter((key): key is StayAmenityKey =>
    STAY_AMENITY_KEYS.includes(key as StayAmenityKey)))];
}
export function stayAmenityWhere(keys: StayAmenityKey[]) {
  return keys.length ? { amenityKeys: { hasEvery: keys } } : {};
}
