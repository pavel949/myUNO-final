import { type PrismaClient } from '@prisma/client';

export const PROJECT_NEARBY_CATEGORIES = [
  'beach', 'dining', 'cafe', 'shopping', 'grocery', 'attraction',
  'marina', 'transport', 'airport', 'school', 'medical', 'other',
] as const;

export interface PublicProjectNearbyPlace {
  id: string;
  slug: string;
  name: string;
  categoryKey: string;
  shortDescription: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  walkingMinutes: number | null;
  drivingMinutes: number | null;
  mapUrl: string | null;
  isFeatured: boolean;
  published: boolean;
}

function optionalString(value: unknown, max = 4000): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function optionalInt(value: unknown, min = 0, max = 10_000_000): number | null {
  if (value === null || value === undefined || value === '') return null;
  const valueNumber = Number(value);
  if (!Number.isInteger(valueNumber) || valueNumber < min || valueNumber > max) {
    throw new Error('Invalid nearby-place numeric value');
  }
  return valueNumber;
}

function optionalCoordinate(value: unknown, axis: 'latitude' | 'longitude'): number | null {
  if (value === null || value === undefined || value === '') return null;
  const valueNumber = Number(value);
  const limit = axis === 'latitude' ? 90 : 180;
  if (!Number.isFinite(valueNumber) || Math.abs(valueNumber) > limit) {
    throw new Error('Invalid nearby-place ' + axis);
  }
  return valueNumber;
}

function optionalUrl(value: unknown): string | null {
  const text = optionalString(value, 1000);
  if (!text) return null;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('Nearby-place map URL must be a valid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Nearby-place map URL must use http or https');
  }
  return parsed.toString();
}

export function nearbyPlaceSlug(value: string): string {
  return value.trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function projectNearbyPlaceData(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : '';
  if (!name) throw new Error('Nearby-place name is required');
  const slug = nearbyPlaceSlug(
    typeof body.slug === 'string' && body.slug.trim() ? body.slug : name
  );
  if (!slug) throw new Error('Nearby-place slug is required');

  const categoryKey = optionalString(body.categoryKey, 80) || 'other';
  const latitude = optionalCoordinate(body.latitude, 'latitude');
  const longitude = optionalCoordinate(body.longitude, 'longitude');
  if ((latitude === null) !== (longitude === null)) {
    throw new Error('Nearby-place latitude and longitude must be supplied together');
  }

  const distanceKm =
    body.distanceKm === null || body.distanceKm === undefined || body.distanceKm === ''
      ? null
      : Number(body.distanceKm);
  if (distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 20_000)) {
    throw new Error('Nearby-place distance must be a valid non-negative kilometre value');
  }

  return {
    name,
    slug,
    categoryKey,
    shortDescription: optionalString(body.shortDescription, 600),
    address: optionalString(body.address, 600),
    latitude,
    longitude,
    distanceMeters: distanceKm === null ? null : Math.round(distanceKm * 1000),
    walkingMinutes: optionalInt(body.walkingMinutes, 1, 100_000),
    drivingMinutes: optionalInt(body.drivingMinutes, 1, 100_000),
    externalUrl: optionalUrl(body.externalUrl),
    isFeatured: body.isFeatured === true,
    published: body.published === true,
    sort: optionalInt(body.sort, 0, 100_000) ?? 0,
  };
}

function validCoordinatePair(latitude: number | null, longitude: number | null): boolean {
  if (latitude === null || longitude === null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  return !(latitude === 0 && longitude === 0);
}

export function distanceMetersBetween(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
): number {
  const radius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(toLatitude - fromLatitude);
  const longDelta = toRadians(toLongitude - fromLongitude);
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(toLatitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(longDelta / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function defaultMapUrl(
  latitude: number | null,
  longitude: number | null,
  address: string | null,
  name: string
): string | null {
  const query = validCoordinatePair(latitude, longitude)
    ? String(latitude) + ',' + String(longitude)
    : (address || name);
  return query
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)
    : null;
}

export async function listProjectNearbyPlaces(
  db: PrismaClient,
  projectId: string,
  projectLatitude: number,
  projectLongitude: number,
  options: { publishedOnly?: boolean } = {}
): Promise<PublicProjectNearbyPlace[]> {
  const rows = await db.projectNearbyPlace.findMany({
    where: {
      projectId,
      ...(options.publishedOnly === false ? {} : { published: true }),
    },
    orderBy: [{ isFeatured: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
  });

  const projectHasCoordinates = validCoordinatePair(projectLatitude, projectLongitude);

  return rows.map((row) => {
    const latitude = row.latitude === null ? null : Number(row.latitude);
    const longitude = row.longitude === null ? null : Number(row.longitude);
    const canDeriveDistance =
      projectHasCoordinates && validCoordinatePair(latitude, longitude);
    const distanceMeters = canDeriveDistance
      ? distanceMetersBetween(projectLatitude, projectLongitude, latitude as number, longitude as number)
      : row.distanceMeters;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryKey: row.categoryKey,
      shortDescription: row.shortDescription,
      address: row.address,
      latitude,
      longitude,
      distanceMeters,
      walkingMinutes: row.walkingMinutes,
      drivingMinutes: row.drivingMinutes,
      mapUrl: row.externalUrl || defaultMapUrl(latitude, longitude, row.address, row.name),
      isFeatured: row.isFeatured,
      published: row.published,
    };
  });
}
