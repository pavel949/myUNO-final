import { prisma } from '@/lib/prisma';

/**
 * Public (unauthenticated) read seam for project discovery pages.
 * Only `live` projects and `live` units are ever exposed — draft and
 * archived inventory stays invisible (doc 08 §4).
 */

export interface PublicProjectCategory {
  key: string;
  styleKey: string | null;
  bedrooms: number | null;
  unitCount: number;
  /** Lowest seasonal nightly rate (satang), else canonical category base price. */
  fromNightlyThb: number | null;
  /** Lowest flat month price (satang) when the category sells long stays. */
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
  categoryKey: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  /** Canonical InventoryCategory base; Unit field only for legacy fallback. */
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

/** All live projects, for the /projects hub and the sitemap. */
export async function listPublicProjects(): Promise<PublicProjectCard[]> {
  const projects = await prisma.project.findMany({
    where: { status: 'live' },
    orderBy: { createdAt: 'asc' },
    include: {
      coverMedia: { select: { storageKey: true } },
      units: {
        where: { status: 'live' },
        select: {
          baseNightlyThb: true,
          inventoryCategory: { select: { baseNightlyThb: true } },
        },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    areaLabelKey: p.areaLabelKey,
    descriptionKey: p.descriptionKey,
    coverUrl: p.coverMedia?.storageKey ?? null,
    liveUnitCount: p.units.length,
    fromNightlyThb: p.units.length
      ? Math.min(
          ...p.units.map((u) => u.inventoryCategory?.baseNightlyThb ?? u.baseNightlyThb)
        )
      : null,
  }));
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
        where: { status: 'live' },
        orderBy: { baseNightlyThb: 'asc' },
        include: {
          coverMedia: { select: { storageKey: true } },
          inventoryCategory: {
            select: {
              id: true,
              categoryKey: true,
              baseNightlyThb: true,
              minNights: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!project || project.status !== 'live') return null;

  const [categories, reviews] = await Promise.all([
    buildPublicCategories(project.id, project.units),
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
    units: project.units.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      categoryKey: u.inventoryCategory?.categoryKey ?? u.categoryKey,
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

/**
 * Category cards keep the existing configured seasonal/monthly presentation
 * while their fallback base now comes from the relational InventoryCategory.
 * The config grids can be retired separately after seasonal rates themselves
 * are fully represented by canonical PricingRule/RatePlan data.
 */
async function buildPublicCategories(
  projectId: string,
  liveUnits: {
    categoryKey: string | null;
    baseNightlyThb: number;
    inventoryCategory: {
      categoryKey: string;
      baseNightlyThb: number;
    } | null;
  }[]
): Promise<PublicProjectCategory[]> {
  // InventoryCategory is the canonical public category source. Do not rebuild
  // the catalogue from legacy config: admin onboarding, search and booking all
  // point at these same rows.
  const categories = await prisma.inventoryCategory.findMany({
    where: { projectId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: {
      categoryKey: true,
      name: true,
      bedrooms: true,
      baseNightlyThb: true,
    },
  });

  return categories
    .map((category) => {
      const units = liveUnits.filter(
        (unit) => (unit.inventoryCategory?.categoryKey ?? unit.categoryKey) === category.categoryKey
      );
      return {
        key: category.categoryKey,
        styleKey: null,
        bedrooms: category.bedrooms,
        unitCount: units.length,
        fromNightlyThb: category.baseNightlyThb,
        monthlyFromThb: null,
      };
    })
    .filter((category) => category.unitCount > 0);
}

async function buildPublicReviews(projectId: string): Promise<PublicProjectReviews> {
  const bookingIds = (
    await prisma.booking.findMany({
      where: { projectId },
      select: { id: true },
    })
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
    Math.round(
      (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
    ) / 10;

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
      coverMedia: { select: { storageKey: true } },
      inventoryCategory: {
        select: {
          categoryKey: true,
          baseNightlyThb: true,
          minNights: true,
          status: true,
        },
      },
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

  if (!unit || unit.status !== 'live' || unit.project.status !== 'live') return null;

  return {
    id: unit.id,
    name: unit.name,
    unitType: unit.unitType,
    categoryKey: unit.inventoryCategory?.categoryKey ?? unit.categoryKey,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    maxGuests: unit.maxGuests,
    sizeSqm: unit.sizeSqm,
    baseNightlyThb: unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
    instantBook: unit.instantBook,
    coverUrl: unit.coverMedia?.storageKey ?? null,
    descriptionKey: unit.descriptionKey,
    minNights: unit.inventoryCategory?.minNights ?? unit.minNights,
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

/** Live units (id only) for the sitemap. */
export async function listPublicUnitIds(): Promise<string[]> {
  const units = await prisma.unit.findMany({
    where: { status: 'live', project: { status: 'live' } },
    select: { id: true },
  });
  return units.map((u) => u.id);
}
