import { describe, expect, it } from 'vitest';
import { normalizeServiceDimensions } from './canonical-commerce.service';

describe('canonical service quantity dimensions', () => {
  it('keeps transfer people, luggage and vehicles separate', () => {
    expect(normalizeServiceDimensions('transfer', { passengers: 4, luggage: 6, vehicles: 2 }))
      .toEqual({ passengers: 4, luggage: 6, vehicles: 2 });
  });

  it('keeps chef guests separate from duration', () => {
    expect(normalizeServiceDimensions('chef', { guests: 8, hours: 3 }))
      .toEqual({ guests: 8, hours: 3 });
  });

  it('requires at least one meaningful cleaning dimension', () => {
    expect(() => normalizeServiceDimensions('cleaning', { rooms: 0, hours: 0, areaSqm: 0 }))
      .toThrow(/cleaning requires/i);
    expect(normalizeServiceDimensions('cleaning', { rooms: 3, hours: 0, areaSqm: 0 }))
      .toEqual({ rooms: 3, hours: 0, areaSqm: 0 });
  });

  it('keeps rental duration separate from resource count', () => {
    expect(normalizeServiceDimensions('car_rental', { days: 5, vehicles: 2 }))
      .toEqual({ days: 5, vehicles: 2 });
  });

  it('rejects invalid negative or fractional quantities', () => {
    expect(() => normalizeServiceDimensions('transfer', { passengers: -1 }))
      .toThrow();
    expect(() => normalizeServiceDimensions('flowers', { items: 1.5 }))
      .toThrow();
  });
});
