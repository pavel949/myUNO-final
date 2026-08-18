import { describe, it, expect } from 'vitest';
import { parseMapBounds, boundsWhere } from './bounds';

/** Reads a viewport out of a plain object, the way the route reads it from a URL. */
const from = (params: Record<string, string>) => (key: string) => params[key] ?? null;

describe('reading a map viewport', () => {
  it('means no map filter when none of it is given', () => {
    const result = parseMapBounds(from({}));

    expect(result).toEqual({ ok: true, bounds: null });
  });

  it('refuses a half-given box rather than ignoring it', () => {
    // Dropping it would return villas outside the map the guest is looking at,
    // while appearing to respect it — worse than an error.
    const result = parseMapBounds(from({ swLat: '7.9', swLng: '98.2', neLat: '8.1' }));

    expect(result.ok).toBe(false);
  });

  it('reads a whole box', () => {
    const result = parseMapBounds(
      from({ swLat: '7.9', swLng: '98.2', neLat: '8.1', neLng: '98.4' })
    );

    expect(result).toEqual({
      ok: true,
      bounds: { swLat: 7.9, swLng: 98.2, neLat: 8.1, neLng: 98.4 },
    });
  });

  it('refuses values that are not numbers', () => {
    const result = parseMapBounds(
      from({ swLat: 'north', swLng: '98.2', neLat: '8.1', neLng: '98.4' })
    );

    expect(result.ok).toBe(false);
  });

  it('refuses coordinates off the earth', () => {
    expect(
      parseMapBounds(from({ swLat: '7.9', swLng: '98.2', neLat: '91', neLng: '98.4' })).ok
    ).toBe(false);
    expect(
      parseMapBounds(from({ swLat: '7.9', swLng: '-181', neLat: '8.1', neLng: '98.4' })).ok
    ).toBe(false);
  });

  it('refuses a box turned upside down', () => {
    const result = parseMapBounds(
      from({ swLat: '8.1', swLng: '98.2', neLat: '7.9', neLng: '98.4' })
    );

    expect(result.ok).toBe(false);
  });

  it('accepts a longitude that reads backwards, because that is a real viewport', () => {
    // A box across the antimeridian arrives west-greater-than-east. It is legal.
    const result = parseMapBounds(
      from({ swLat: '-10', swLng: '170', neLat: '10', neLng: '-170' })
    );

    expect(result.ok).toBe(true);
  });
});

describe('the where fragment', () => {
  it('filters on the project, because a villa is where its development is', () => {
    const where = boundsWhere({ swLat: 7.9, swLng: 98.2, neLat: 8.1, neLng: 98.4 });

    expect(where).toEqual({
      project: {
        latitude: { gte: 7.9, lte: 8.1 },
        longitude: { gte: 98.2, lte: 98.4 },
      },
    });
  });

  it('splits a box that crosses the antimeridian into two, not an empty range', () => {
    // gte:170 AND lte:-170 matches nothing, so a legal viewport would return an
    // empty map — the kind of bug nobody debugs at the time.
    const where = boundsWhere({ swLat: -10, swLng: 170, neLat: 10, neLng: -170 });

    expect(where.project).toMatchObject({
      latitude: { gte: -10, lte: 10 },
      OR: [{ longitude: { gte: 170 } }, { longitude: { lte: -170 } }],
    });
  });
});
