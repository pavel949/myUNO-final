/**
 * "Show me what's in this area."
 *
 * A guest who has panned a map to Bang Tao is asking a question the search
 * could not hear. This turns the four corners of a map viewport into a filter.
 *
 * The filter lands on the **project**, not the unit, and that is the model
 * rather than a compromise: a unit's location *is* its project's, and giving
 * `Unit` its own coordinates would create two answers to one question, free to
 * drift apart. A villa is where its development is.
 */

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export type BoundsParse =
  | { ok: true; bounds: MapBounds | null }
  | { ok: false; error: string };

const CORNERS = ['swLat', 'swLng', 'neLat', 'neLng'] as const;

/**
 * Read a viewport out of query parameters.
 *
 * Absent entirely means "no map filter" — a plain list search. But a **partly**
 * given box is refused rather than ignored: silently dropping it would return
 * villas outside the map the guest is looking at, while appearing to respect
 * it. An answer that looks filtered and is not is worse than an error.
 */
export function parseMapBounds(get: (key: string) => string | null): BoundsParse {
  const raw = CORNERS.map((key) => get(key));
  const given = raw.filter((value) => value !== null && value !== '');

  if (given.length === 0) return { ok: true, bounds: null };
  if (given.length < CORNERS.length) {
    return { ok: false, error: 'Map bounds need all four of swLat, swLng, neLat, neLng' };
  }

  const [swLat, swLng, neLat, neLng] = raw.map((value) => Number(value));
  if ([swLat, swLng, neLat, neLng].some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Map bounds must be numbers' };
  }
  if (Math.abs(swLat) > 90 || Math.abs(neLat) > 90) {
    return { ok: false, error: 'Latitude must be between -90 and 90' };
  }
  if (Math.abs(swLng) > 180 || Math.abs(neLng) > 180) {
    return { ok: false, error: 'Longitude must be between -180 and 180' };
  }
  if (swLat > neLat) {
    return { ok: false, error: 'The south-west corner must be south of the north-east corner' };
  }

  return { ok: true, bounds: { swLat, swLng, neLat, neLng } };
}

/**
 * The Prisma `where` fragment for a viewport, to be spread onto a unit query.
 *
 * Longitude is not a simple `between`. A viewport that crosses the antimeridian
 * arrives with its west edge numerically **greater** than its east edge
 * (e.g. 170 → -170), and a `gte/lte` pair would then match nothing at all.
 * Phuket is nowhere near 180°, so this will not fire here — but a filter that
 * silently returns an empty map for a legal viewport is the kind of thing
 * nobody debugs at the time, so it is handled where it is understood.
 */
export function boundsWhere(bounds: MapBounds) {
  const latitude = { gte: bounds.swLat, lte: bounds.neLat };
  const longitude =
    bounds.swLng <= bounds.neLng
      ? { gte: bounds.swLng, lte: bounds.neLng }
      : undefined;

  return {
    project: longitude
      ? { latitude, longitude }
      : {
          latitude,
          OR: [
            { longitude: { gte: bounds.swLng } },
            { longitude: { lte: bounds.neLng } },
          ],
        },
  };
}
