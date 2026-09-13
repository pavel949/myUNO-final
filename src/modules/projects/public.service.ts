import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';

export interface PublicProjectCategory {
  id: string;
  key: string;
  name: string;
  styleKey: string | null;
  bedrooms: number | null;
  unitCount: number;
  fromNightlyThb: number | null;
  monthlyFromThb: number | null;
}

export interface PublicProjectReview {
  rating: number;
  comment: string | null;
  authorFirstName: string;
  createdAt: string;
  reply: string | null;
}

export interface PublicProjectReviews {
  average: number | null;
  count: number;
  items: PublicProjectReview[];
}

export interface PublicProjectCard {
  id: string;
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  coverUrl: string | null;
  liveUnitCount: number;
  fromNightlyThb: number | null;
}

export interface PublicProjectUnit {
  id: string;
  name: string;
  unitType: string;
  inventoryCategoryId: string | null;
  /** Compatibility slug for old links; derived from InventoryCategory. */
  categoryKey: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  /** Compatibility display value; derived from canonical category when present. */
  baseNightlyThb: number;
  instantBook: boolean;
  coverUrl: string | null;
}

export interface PublicProjectDetail {
  id: string;
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  handbookKey: string;
  address: string;
  latitude: number;
  longitude: number;
  amenityKeys: string[];
  coverUrl: string | null;
  galleryUrls: string[];
  units: PublicProjectUnit[];
  categories: PublicProjectCategory[];
  reviews: PublicProjectReviews;
}

export async function listPublicProjects(): Promise<PublicProjectCard[]> {
  const projects = await prisma.project.findMany({
    where: { status: 'live' },
    orderBy: { createdAt: 'asc' },
    include: {
      coverMedia: { select: { storageKey: true } },
      units: {
        where: { status: 'live', inventoryCategoryId: { not: null } },
        include: { inventoryCategory: true },
      },
    },
  });

  return projects.map((p) => {
    const canonicalRates = p.units
      .map((u) => u.inventoryCategory?.baseNightlyThb)
      .filter((value): value is number => typeof value === 'number');
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      areaLabelKey: p.areaLabelKey,
      descriptionKey: p.descriptionKey,
      coverUrl: p.coverMedia?.storageKey ?? null,
      liveUnitCount: p.units.length,
      fromNightlyThb: canonicalRates.length ? Math.min(...canonicalRates) : null,
    };
  });
}

export async function getPublicProjectBySlug(
  slug: string
): Promise<PublicProjectDetail | null> {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      coverMedia: { select: { storageKey: true } },
      galleryMedia: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { storageKey: true } } },
      },
      units: {
        where: { status: 'live', inventoryCategoryId: { not: null } },
        include: {
          inventoryCategory: true,
          coverMedia: { select: { storageKey: true } },
        },
      },
    },
  });

  if (!project || project.status !== 'live') return null;

  const sortedUnits = [...project.units].sort((a, b) => {
    const aRate = a.inventoryCategory?.baseNightlyThb ?? Number.MAX_SAFE_INTEGER;
    const bRate = b.inventoryCategory?.baseNightlyThb ?? Number.MAX_SAFE_INTEGER;
    return aRate - bRate || a.id.localeCompare(b.id);
  });

  const [categories, reviews] = await Promise.all([
    buildPublicCategories(project.id),
    buildPublicReviews(project.id),
  ]);

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    areaLabelKey: project.areaLabelKey,
    descriptionKey: project.descriptionKey,
    handbookKey: project.handbookKey,
    address: project.address,
    latitude: Number(project.latitude),
    longitude: Number(project.longitude),
    amenityKeys: project.amenityKeys,
    coverUrl: project.coverMedia?.storageKey ?? null,
    galleryUrls: project.galleryMedia.map((g) => g.media.storageKey),
    units: sortedUnits.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      inventoryCategoryId: u.inventoryCategoryId,
      categoryKey: u.inventoryCategory?.categoryKey ?? null,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      sizeSqm: u.sizeSqm,
      baseNightlyThb: u.inventoryCategory?.baseNightlyThb ?? u.baseNightlyThb,
      instantBook: u.instantBook,
      coverUrl: u.coverMedia?.storageKey ?? null,
    })),
    categories,
    reviews,
  };
}

async function buildPublicCategories(projectId: string): Promise<PublicProjectCategory[]> {
  const [categories, rates] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: { projectId, status: 'live' },
      include: {
        units: { where: { status: 'live' }, select: { id: true } },
        ratePlans: { where: { status: 'active', code: 'BAR' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    }),
    getConfig(prisma, 'pricing.category_rates', { projectId }).catch(() => ({})),
  ]);

  const configuredRates = (rates ?? {}) as Record<
    string,
    { nightly?: Record<string, number>; monthly?: Record<string, number> }
  >;

  return categories
    .filter((category) => category.units.length > 0)
    .map((category) => {
      const nightlyValues = Object.values(configuredRates[category.categoryKey]?.nightly ?? {});
      const monthlyValues = Object.values(configuredRates[category.categoryKey]?.monthly ?? {});
      return {
        id: category.id,
        key: category.categoryKey,
        name: category.name,
        styleKey: null,
        bedrooms: category.bedrooms,
        unitCount: category.units.length,
        fromNightlyThb: nightlyValues.length
          ? Math.min(...nightlyValues)
          : category.baseNightlyThb,
        monthlyFromThb: monthlyValues.length ? Math.min(...monthlyValues) : null,
      };
    });
}

async function buildPublicReviews(projectId: string): Promise<PublicProjectReviews> {
  const bookingIds = (
    await prisma.booking.findMany({ where: { projectId }, select: { id: true } })
  ).map((b) => b.id);

  if (bookingIds.length === 0) return { average: null, count: 0, items: [] };

  const reviews = await prisma.review.findMany({
    where: {
      target_type: 'stay',
      target_id: { in: bookingIds },
      status: 'published',
    },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { firstName: true } } },
  });

  if (reviews.length === 0) return { average: null, count: 0, items: [] };

  const average =
    Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;

  return {
    average,
    count: reviews.length,
    items: reviews.slice(0, 6).map((r) => ({
      rating: r.rating,
      comment: r.comment,
      authorFirstName: r.author.firstName,
      createdAt: r.createdAt.toISOString(),
      reply: r.reply,
    })),
  };
}

export interface PublicUnitDetail extends PublicProjectUnit {
  descriptionKey: string | null;
  minNights: number;
  amenityKeys: string[];
  project: {
    slug: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

export async function getPublicUnitById(id: string): Promise<PublicUnitDetail | null> {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      inventoryCategory: {
        include: {
          ratePlans: {
            where: { status: 'active', code: 'BAR' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      coverMedia: { select: { storageKey: true } },
      project: {
        select: {
          slug: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
        },
      },
    },
  });

  if (
    !unit ||
    unit.status !== 'live' ||
    unit.project.status !== 'live' ||
    !unit.inventoryCategory
  ) {
    return null;
  }

  const bar = unit.inventoryCategory.ratePlans[0] ?? null;

  return {
    id: unit.id,
    name: unit.name,
    unitType: unit.unitType,
    inventoryCategoryId: unit.inventoryCategory.id,
    categoryKey: unit.inventoryCategory.categoryKey,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    maxGuests: unit.maxGuests,
    sizeSqm: unit.sizeSqm,
    baseNightlyThb: unit.inventoryCategory.baseNightlyThb,
    instantBook: unit.instantBook,
    coverUrl: unit.coverMedia?.storageKey ?? null,
    descriptionKey: unit.descriptionKey,
    minNights: bar?.minNights ?? unit.inventoryCategory.minNights,
    amenityKeys: unit.amenityKeys,
    project: {
      slug: unit.project.slug,
      name: unit.project.name,
      address: unit.project.address,
      latitude: Number(unit.project.latitude),
      longitude: Number(unit.project.longitude),
    },
  };
}

export async function listPublicUnitIds(): Promise<string[]> {
  const units = await prisma.unit.findMany({
    where: {
      status: 'live',
      inventoryCategoryId: { not: null },
      project: { status: 'live' },
    },
    select: { id: true },
  });
  return units.map((u) => u.id);
}
