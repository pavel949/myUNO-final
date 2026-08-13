import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';

/**
 * Public (unauthenticated) read seam for project discovery pages.
 * Only `live` projects and `live` units are ever exposed — draft and
 * archived inventory stays invisible (doc 08 §4).
 */

/** A sellable villa category on a project's landing (LY-5): counts and
 *  "from" prices come from the project's config catalog + rate grid. */
export interface PublicProjectCategory {
  key: string;
  styleKey: string | null;
  bedrooms: number | null;
  unitCount: number;
  /** Lowest seasonal nightly rate (satang), else lowest unit base price. */
  fromNightlyThb: number | null;
  /** Lowest flat month price (satang) when the category sells long stays. */
  monthlyFromThb: number | null;
}

/** A published guest review of a stay in this project (LY-5). */
export interface PublicProjectReview {
  rating: number;
  comment: string | null;
  authorFirstName: string;
  createdAt: string; // ISO
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
  /** Empty for projects without a unit-categories catalog — the landing
   *  renders its category/styles sections only when entries exist. */
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
        select: { baseNightlyThb: true },
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
      ? Math.min(...p.units.map((u) => u.baseNightlyThb))
      : null,
  }));
}

/**
 * One live project by slug with its gallery and live units.
 * Returns null for unknown slugs AND for non-live projects, so drafts
 * never leak through a guessed URL.
 */
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
        include: { coverMedia: { select: { storageKey: true } } },
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
      categoryKey: u.categoryKey,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      sizeSqm: u.sizeSqm,
      baseNightlyThb: u.baseNightlyThb,
      instantBook: u.instantBook,
      coverUrl: u.coverMedia?.storageKey ?? null,
    })),
    categories,
    reviews,
  };
}

/**
 * Category cards for the landing: entries from the project's
 * catalog.unit_categories config, counts from live units, "from" prices from
 * the pricing.category_rates grid (lowest season), falling back to the
 * cheapest unit base price when no rates are configured.
 */
async function buildPublicCategories(
  projectId: string,
  liveUnits: { categoryKey: string | null; baseNightlyThb: number }[]
): Promise<PublicProjectCategory[]> {
  const catalog =
    (await getConfig(prisma, 'catalog.unit_categories', { projectId })) ?? [];
  if (!Array.isArray(catalog) || catalog.length === 0) return [];

  const rates =
    (await getConfig(prisma, 'pricing.category_rates', { projectId })) ?? {};

  return catalog
    .map((entry) => {
      const units = liveUnits.filter((u) => u.categoryKey === entry.key);
      const nightly = rates[entry.key]?.nightly;
      const monthly = rates[entry.key]?.monthly;
      const nightlyValues = nightly ? Object.values(nightly) : [];
      const monthlyValues = monthly ? Object.values(monthly) : [];
      return {
        key: entry.key,
        styleKey: entry.style_key ?? null,
        bedrooms: entry.bedrooms ?? null,
        unitCount: units.length,
        fromNightlyThb: nightlyValues.length
          ? Math.min(...nightlyValues)
          : units.length
            ? Math.min(...units.map((u) => u.baseNightlyThb))
            : null,
        monthlyFromThb: monthlyValues.length ? Math.min(...monthlyValues) : null,
      };
    })
    .filter((c) => c.unitCount > 0);
}

/**
 * Published stay reviews for a project: Review(target_type='stay') joined to
 * the project's bookings. Only the author's first name is ever exposed.
 */
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

/** Live units (id only) for the sitemap. */
export async function listPublicUnitIds(): Promise<string[]> {
  const units = await prisma.unit.findMany({
    where: { status: 'live', project: { status: 'live' } },
    select: { id: true },
  });
  return units.map((u) => u.id);
}
