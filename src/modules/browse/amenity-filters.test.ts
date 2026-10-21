import { describe, expect, it } from 'vitest';
import { parseStayAmenities, stayAmenityWhere } from './amenity-filters';

describe('public stay amenity filtering', () => {
  it('allows only supported recorded amenities and removes duplicates', () => {
    expect(parseStayAmenities('pool,wifi,pool,walk_to_beach,private_pool,unknown')).toEqual(['pool', 'wifi']);
  });
  it('requires every selected amenity on the same home', () => {
    expect(stayAmenityWhere(parseStayAmenities('wifi,washer'))).toEqual({ amenityKeys: { hasEvery: ['wifi', 'washer'] } });
    expect(stayAmenityWhere([])).toEqual({});
  });
});
