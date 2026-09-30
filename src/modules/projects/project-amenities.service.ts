import { Prisma, type PrismaClient } from '@prisma/client';

export const PROJECT_AMENITY_ACCESS_TYPES = [
  'open', 'room_key', 'key_card', 'wristband', 'staff_assisted',
  'reservation', 'membership', 'other',
] as const;
export const PROJECT_AMENITY_BOOKING_MODES = [
  'none', 'reception', 'request', 'time_slot', 'external_link', 'other',
] as const;
export const PROJECT_AMENITY_PRICING_TYPES = [
  'included', 'free', 'paid', 'deposit', 'mixed',
] as const;

export function amenitySlug(value: string): string {
  return value.trim().toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function optionalString(value: unknown, max = 4000): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}
function optionalInt(value: unknown, min = 0, max = 1_000_000): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('Invalid numeric amenity value');
  return n;
}
function optionalJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function projectAmenityData(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : '';
  if (!name) throw new Error('Amenity name is required');
  const slug = amenitySlug(typeof body.slug === 'string' && body.slug.trim() ? body.slug : name);
  if (!slug) throw new Error('Amenity slug is required');
  const bookingRequired = body.bookingRequired === true;
  const pricingType = optionalString(body.pricingType, 40) ?? 'included';
  const accessType = optionalString(body.accessType, 40) ?? 'open';
  const bookingMode = bookingRequired ? (optionalString(body.bookingMode, 40) ?? 'request') : 'none';
  const priceBaht = body.priceBaht === '' || body.priceBaht == null ? null : Number(body.priceBaht);
  if (priceBaht !== null && (!Number.isFinite(priceBaht) || priceBaht < 0 || priceBaht > 100_000_000)) {
    throw new Error('Amenity price must be a valid non-negative THB amount');
  }
  return {
    name,
    slug,
    categoryKey: optionalString(body.categoryKey, 80),
    shortDescription: optionalString(body.shortDescription, 280),
    description: optionalString(body.description, 12000),
    iconKey: optionalString(body.iconKey, 80),
    locationLabel: optionalString(body.locationLabel, 240),
    accessType,
    accessInstructions: optionalString(body.accessInstructions, 4000),
    bookingRequired,
    bookingMode,
    bookingUrl: optionalString(body.bookingUrl, 1000),
    pricingType,
    priceThb: priceBaht === null ? null : Math.round(priceBaht * 100),
    capacity: optionalInt(body.capacity, 1, 100000),
    minAge: optionalInt(body.minAge, 0, 120),
    openingHours: optionalJson(body.openingHours),
    rules: optionalJson(body.rules),
    terms: optionalString(body.terms, 12000),
    isFeatured: body.isFeatured === true,
    published: body.published === true,
    sort: optionalInt(body.sort, 0, 100000) ?? 0,
  };
}

export const publicAmenityInclude = {
  coverMedia: { select: { storageKey: true } },
  media: {
    orderBy: [{ sort: 'asc' as const }, { mediaId: 'asc' as const }],
    include: { media: { select: { storageKey: true } } },
  },
} satisfies Prisma.ProjectAmenityInclude;

export async function listPublicProjectAmenities(db: PrismaClient, projectId: string) {
  const rows = await db.projectAmenity.findMany({
    where: { projectId, published: true },
    include: publicAmenityInclude,
    orderBy: [{ isFeatured: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
  });
  return rows.map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryKey: row.categoryKey,
    shortDescription: row.shortDescription,
    description: row.description,
    iconKey: row.iconKey,
    locationLabel: row.locationLabel,
    accessType: row.accessType,
    accessInstructions: row.accessInstructions,
    bookingRequired: row.bookingRequired,
    bookingMode: row.bookingMode,
    bookingUrl: row.bookingUrl,
    pricingType: row.pricingType,
    priceThb: row.priceThb,
    capacity: row.capacity,
    minAge: row.minAge,
    openingHours: row.openingHours,
    rules: row.rules,
    terms: row.terms,
    isFeatured: row.isFeatured,
    coverUrl: row.coverMedia?.storageKey ?? row.media[0]?.media.storageKey ?? null,
    galleryUrls: row.media.map(item => item.media.storageKey),
  }));
}
