import { describe, expect, it } from 'vitest';
import { amenitySlug, projectAmenityData } from './project-amenities.service';

describe('ProjectAmenity', () => {
  it('supports novel amenity names and open-vocabulary project rules without schema changes', () => {
    const data = projectAmenityData({
      name: 'Private Cinema & Screening Room',
      categoryKey: 'entertainment',
      accessType: 'resident_card_plus_booking',
      bookingRequired: true,
      bookingMode: 'time_slot',
      pricingType: 'mixed',
      priceBaht: 250.50,
      capacity: 18,
      minAge: 12,
      openingHours: { daily: [['09:00','23:00']] },
      rules: ['Book up to 2 hours', 'No food after 21:00'],
      terms: 'Resident and registered guest use only.',
      isFeatured: true,
      published: true,
    });

    expect(data.slug).toBe('private-cinema-screening-room');
    expect(data.accessType).toBe('resident_card_plus_booking');
    expect(data.bookingMode).toBe('time_slot');
    expect(data.priceThb).toBe(25_050);
    expect(data.capacity).toBe(18);
    expect(data.rules).toEqual(['Book up to 2 hours', 'No food after 21:00']);
  });

  it('models a free open facility without requiring booking fields', () => {
    const data = projectAmenityData({
      name: 'Fitness Center',
      accessType: 'key_card',
      bookingRequired: false,
      pricingType: 'included',
    });
    expect(data.bookingMode).toBe('none');
    expect(data.priceThb).toBeNull();
    expect(data.published).toBe(false);
  });

  it('generates stable amenity slugs', () => {
    expect(amenitySlug('  Theatre Room / Level 3  ')).toBe('theatre-room-level-3');
  });

  it('rejects invalid project-level money and capacity', () => {
    expect(() => projectAmenityData({ name: 'Sauna', priceBaht: -1 })).toThrow();
    expect(() => projectAmenityData({ name: 'Sauna', capacity: 0 })).toThrow();
  });
});
