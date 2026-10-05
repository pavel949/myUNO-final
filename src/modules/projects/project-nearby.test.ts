import { describe, expect, it } from 'vitest';
import {
  distanceMetersBetween,
  nearbyPlaceSlug,
  projectNearbyPlaceData,
} from './project-nearby.service';

describe('canonical project nearby places', () => {
  it('normalizes stable slugs without constraining the category vocabulary', () => {
    expect(nearbyPlaceSlug('Bang Tao Beach')).toBe('bang-tao-beach');
    expect(projectNearbyPlaceData({
      name: 'Beach club',
      categoryKey: 'local_partner_category',
      published: true,
    }).categoryKey).toBe('local_partner_category');
  });

  it('stores manual distance in metres and validates coordinate pairs', () => {
    expect(projectNearbyPlaceData({
      name: 'Beach',
      distanceKm: '1.25',
      walkingMinutes: '16',
    }).distanceMeters).toBe(1250);
    expect(() => projectNearbyPlaceData({
      name: 'Broken',
      latitude: '7.99',
    })).toThrow(/latitude and longitude/);
  });

  it('derives a deterministic straight-line distance from coordinates', () => {
    const metres = distanceMetersBetween(7.992, 98.304, 7.997, 98.304);
    expect(metres).toBeGreaterThan(500);
    expect(metres).toBeLessThan(600);
  });

  it('rejects unsafe external URL schemes', () => {
    expect(() => projectNearbyPlaceData({
      name: 'Unsafe',
      externalUrl: 'javascript:alert(1)',
    })).toThrow(/http or https/);
  });
});
