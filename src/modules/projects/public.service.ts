import { PUBLIC_SLEEPING_SPACES_QUERY, publicSleepingSpaces, type PublicSleepingSpace } from './public-sleeping';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { allExcludedSourceControlledUnitIds } from '@/modules/booking/source-authority';
import { managedImportedInventoryIds } from './public-managed-import';
import { discoveryVisibility } from './public-discovery';
import { categoryEditorialKeys } from './project-editorial';
import { tMany, type Locale } from '@/modules/content';
import { listPublicProjectAmenities } from './project-amenities.service';
import { listProjectNearbyPlaces } from './project-nearby.service';
import {
  assessGalleryReadiness,
  assessUnitMediaReadiness,
} from '@/modules/media/public-readiness';
import {
  resolveProjectResponsibility,
  resolveUnitResponsibility,
  type PublicResponsibility,
} from './public-responsibility';

/** Public accommodation projections must apply the same offering and source-authority scope as Stay Search. */
function publicStayUnitWhere(excludedIds: string[], managedUnitIds: string[] = []): Prisma.UnitWhereInput {
  return {
    assetStatus: { not: 'suspended' },
    inventoryCategory: { status: 'live' },
    ...(excludedIds.length ? { id: { notIn: excludedIds } } : {}),
    AND: [
      {
        OR: [
          { status: 'live' },
          ...(managedUnitIds.length
            ? [{ status: 'draft' as const, id: { in: managedUnitIds } }]
            : []),
        ],
      },
      {
        OR: [
          { project: { projectType: null } }, // Legacy untyped projects retain compatibility until migrated.
          { commercialOfferings: { some: { offeringType: { in: ['short_term_stay', 'short_stay'] }, status: 'active' } } },
        ],
      },
    ],
  };
}


/**
 * Public (unauthenticated) read seam for project discovery pages.
 * Live inventory is public by default. Imported managed rows may also be
 * visible while their legacy status remains draft; that provenance does not
 * by itself make them bookable. Archived inventory stays invisible.
 */

export interface PublicProjectCategory {
  id: string;
  key: string;
  name: string;
  titleKey: string;
  descriptionKey: string;
  styleKey: string | null;
  bedrooms: number | null;
  unitCount: number;
  /** Lowest seasonal nightly rate (satang), else canonical category base price. */
  fromNightlyThb: number | null;
  /** Lowest flat month price (satang) when the category sells long stays. */
  monthlyFromThb: number | null;
  coverUrl: string | null;
  galleryUrls: string[];
  videoUrls?: string[];
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
  areaName: string | null;
  descriptionKey: string;
  coverUrl: string | null;
  liveUnitCount: number;
  fromNightlyThb: number | null;
  featuredAmenities: Array<{ id: string; slug: string; name: string; iconKey: string | null }>;
  responsibility: PublicResponsibility;
}

export interface PublicProjectUnit {
  id: string;
  name: string;
  titleKey: string | null;
  descriptionKey: string | null;
  unitType: string;
  categoryKey: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  usableAreaSqm: number | null;
  grossAreaSqm: number | null;
  outdoorAreaSqm: number | null;
  plotAreaSqm: number | null;
  unitFeatures: string[];
  views: string[];
  /** Canonical InventoryCategory base; Unit field only for legacy fallback. */
  baseNightlyThb: number;
  instantBook: boolean;
  coverUrl: string | null;
  galleryUrls: string[];
  videoUrls?: string[];
  photoScope?: 'exact_unit' | 'room_type';
  /** Visible catalogue fact is independent from whether online stay booking is ready. */
  mediaReady: boolean;
  bookable: boolean;
}

export interface PublicProjectDetail {
  id: string;
  projectType: string | null;
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  handbookKey: string;
  address: string;
  latitude: number;
  longitude: number;
  amenityKeys: string[];
  areaNameKey: string | null;
  areaDescriptionKey: string | null;
  coverUrl: string | null;
  galleryUrls: string[];
  videoUrls?: string[];
  units: PublicProjectUnit[];
  categories: PublicProjectCategory[];
  reviews: PublicProjectReviews;
  amenities: Awaited<ReturnType<typeof listPublicProjectAmenities>>;
  nearbyPlaces: Awaited<ReturnType<typeof listProjectNearbyPlaces>>;
}

/** All live projects, for the /projects hub and the sitemap. */
export async function listPublicProjects(locale: Locale = 'en'): Promise<PublicProjectCard[]> {
  const [excludedIds, managedImported] = await Promise.all([
    allExcludedSourceControlledUnitIds(prisma),
    managedImportedInventoryIds(prisma),
  ]);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { status: 'live' },
        ...(managedImported.projectIds.length
          ? [{ status: 'draft' as const, id: { in: managedImported.projectIds } }]
          : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: {
      coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
      galleryMedia: {
        orderBy: { sort: 'asc' },
        include: {
          media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
        },
      },
      area: { select: { nameKey: true } },
      orgRoles: {
        select: {
          roleKey: true,
          effectiveFrom: true,
          effectiveTo: true,
          provenance: true,
          organization: { select: { name: true, status: true } },
        },
      },
      amenities: {
        where: { published: true, isFeatured: true },
        select: { id: true, slug: true, name: true, iconKey: true },
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
        take: 4,
      },
      units: {
        where: {
          ...discoveryVisibility(managedImported),
        },
        select: {
          id: true,
          status: true,
          assetStatus: true,
          project: { select: { projectType: true } },
          accommodationType: true,
          coverMediaId: true,
          media: {
            orderBy: { sort: 'asc' },
            include: {
              media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
            },
          },
          baseNightlyThb: true,
          commercialOfferings: {
            where: { status: 'active' },
            select: { offeringType: true, status: true },
          },
          engagements: {
            select: {
              status: true,
              mandateMediaId: true,
              startsOn: true,
              endsOn: true,
              managementOrg: { select: { name: true, status: true } },
            },
          },
          inventoryCategory: {
            select: {
              status: true,
              baseNightlyThb: true,
              coverMediaId: true,
              galleryMedia: {
                orderBy: { sort: 'asc' },
                include: {
                  media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const publicCopyKeys = projects.flatMap(project => [
    ...(project.area?.nameKey ? [project.area.nameKey] : []),
    ...project.amenities.map(amenity => `project_amenity.${amenity.id}.name`),
  ]);
  const publicCopy = publicCopyKeys.length
    ? await tMany(prisma, publicCopyKeys, locale)
    : {};

  return projects.map((p) => {
    const projectMedia = assessGalleryReadiness({
      coverMediaId: p.coverMediaId,
      links: p.galleryMedia,
    });
    const bookableUnits = p.units.filter((unit) => {
      const mediaReady = assessUnitMediaReadiness({
        projectType: unit.project.projectType,
        accommodationType: unit.accommodationType,
        unitCoverMediaId: unit.coverMediaId,
        unitMedia: unit.media,
        categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
        categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
      }).ready;
      const hasStayOffering = p.projectType === null || unit.commercialOfferings.some(
        offering => ['short_term_stay', 'short_stay'].includes(offering.offeringType)
      );
      return p.status === 'live' &&
        unit.status === 'live' &&
        unit.assetStatus !== 'suspended' &&
        mediaReady &&
        hasStayOffering &&
        unit.inventoryCategory?.status === 'live' &&
        !excludedIds.includes(unit.id);
    });
    const managedUnits = p.units.flatMap((unit) => {
      const responsibility = resolveUnitResponsibility(unit.engagements);
      return responsibility.verified && responsibility.organizationName
        ? [{ organizationName: responsibility.organizationName }]
        : [];
    });
    const responsibility = resolveProjectResponsibility(
      p.orgRoles,
      managedUnits,
      p.units.length,
    );
    const pricedBookableUnits = bookableUnits.filter(
      unit => (unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb) > 0
    );
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      areaLabelKey: p.areaLabelKey,
      areaName: p.area?.nameKey ? (publicCopy[p.area.nameKey] || null) : null,
      descriptionKey: p.descriptionKey,
      coverUrl: projectMedia.ready ? projectMedia.coverUrl : null,
      liveUnitCount: p.units.length,
      fromNightlyThb: pricedBookableUnits.length
        ? Math.min(
            ...pricedBookableUnits.map((u) => u.inventoryCategory?.baseNightlyThb ?? u.baseNightlyThb)
          )
        : null,
      featuredAmenities: p.amenities.map(amenity => ({
        ...amenity,
        name: publicCopy[`project_amenity.${amenity.id}.name`] || amenity.name,
      })),
      responsibility,
    };
  });
}

export async function getPublicProjectBySlug(
  slug: string,
  locale: Locale = 'en'
): Promise<PublicProjectDetail | null> {
  const [excludedIds, managedImported] = await Promise.all([
    allExcludedSourceControlledUnitIds(prisma),
    managedImportedInventoryIds(prisma),
  ]);
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      area: { select: { nameKey: true, descriptionKey: true } },
      coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
      galleryMedia: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
      },
      units: {
        where: {
          ...discoveryVisibility(managedImported),
        },
        orderBy: [{ name: 'asc' }],
        include: {
          coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
          media: {
            orderBy: { sort: 'asc' },
            include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
          },
          commercialOfferings: {
            where: { status: 'active' },
            select: { offeringType: true, status: true },
          },
          inventoryCategory: {
            select: {
              id: true,
              categoryKey: true,
              baseNightlyThb: true,
              minNights: true,
              status: true,
              coverMediaId: true,
              coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
              galleryMedia: {
                orderBy: { sort: 'asc' },
                include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (
    !project ||
    (project.status !== 'live' && !(project.status === 'draft' && managedImported.projectIds.includes(project.id)))
  ) return null;

  const publicUnits = project.units.map((unit) => {
    const media = assessUnitMediaReadiness({
      projectType: project.projectType,
      accommodationType: unit.accommodationType,
      unitCoverMediaId: unit.coverMediaId,
      unitMedia: unit.media,
      categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
      categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
    });
    const hasStayOffering = project.projectType === null || unit.commercialOfferings.some(
      offering => ['short_term_stay', 'short_stay'].includes(offering.offeringType)
    );
    const bookable = project.status === 'live' &&
      unit.status === 'live' &&
      unit.assetStatus !== 'suspended' &&
      media.ready &&
      hasStayOffering &&
      unit.inventoryCategory?.status === 'live' &&
      !excludedIds.includes(unit.id) &&
      (unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb) > 0;
    return { unit, media, bookable };
  });
  const projectMedia = assessGalleryReadiness({
    coverMediaId: project.coverMediaId,
    links: project.galleryMedia,
  });

  const [categories, reviews, amenities, nearbyPlaces] = await Promise.all([
    buildPublicCategories(project.id, project.slug, publicUnits.map(({ unit, bookable }) => ({ ...unit, bookable }))),
    buildPublicReviews(project.id),
    listPublicProjectAmenities(prisma, project.id, locale),
    listProjectNearbyPlaces(prisma, project.id, Number(project.latitude), Number(project.longitude))
      .catch((error) => {
        console.error('[project] nearby-place layer unavailable; rendering portal without nearby places', error);
        return [];
      }),
  ]);

  return {
    id: project.id,
    projectType: project.projectType,
    slug: project.slug,
    name: project.name,
    areaLabelKey: project.areaLabelKey,
    descriptionKey: project.descriptionKey,
    handbookKey: project.handbookKey,
    address: project.address,
    latitude: Number(project.latitude),
    longitude: Number(project.longitude),
    amenityKeys: project.amenityKeys,
    areaNameKey: project.area?.nameKey ?? null,
    areaDescriptionKey: project.area?.descriptionKey ?? null,
    coverUrl: projectMedia.ready ? projectMedia.coverUrl : null,
    galleryUrls: projectMedia.ready ? projectMedia.urls : [],
    videoUrls: projectMedia.ready ? projectMedia.videoUrls : [],
    units: publicUnits.map(({ unit: u, media, bookable }) => ({
      id: u.id,
      name: u.name,
      titleKey: u.descriptionKey ? u.descriptionKey.replace(/\.description$/, '.title') : null,
      descriptionKey: u.descriptionKey,
      unitType: u.unitType,
      categoryKey: u.inventoryCategory?.categoryKey ?? u.categoryKey,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      sizeSqm: u.sizeSqm,
      usableAreaSqm: u.usableAreaSqm === null ? null : Number(u.usableAreaSqm),
      grossAreaSqm: u.grossAreaSqm === null ? null : Number(u.grossAreaSqm),
      outdoorAreaSqm: u.outdoorAreaSqm === null ? null : Number(u.outdoorAreaSqm),
      plotAreaSqm: u.plotAreaSqm === null ? null : Number(u.plotAreaSqm),
      unitFeatures: u.unitFeatures,
      views: u.views,
      baseNightlyThb: u.inventoryCategory?.baseNightlyThb ?? u.baseNightlyThb,
      instantBook: bookable && u.instantBook,
      coverUrl: media.ready ? media.coverUrl : null,
      galleryUrls: media.ready ? media.urls : [],
      videoUrls: media.ready ? media.videoUrls : [],
      photoScope: media.ready ? (media.photoScope === 'room_type' ? 'room_type' : 'exact_unit') : undefined,
      mediaReady: media.ready,
      bookable,
    })),
    categories,
    reviews,
    amenities,
    nearbyPlaces,
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
  projectSlug: string,
  visibleUnits: {
    bookable: boolean;
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
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      categoryKey: true,
      name: true,
      bedrooms: true,
      baseNightlyThb: true,
      coverMediaId: true,
      coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
      galleryMedia: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
      },
    },
  });

  return categories
    .flatMap((category) => {
      const categoryMedia = assessGalleryReadiness({
        coverMediaId: category.coverMediaId,
        links: category.galleryMedia,
      });
      const units = visibleUnits.filter(
        (unit) => (unit.inventoryCategory?.categoryKey ?? unit.categoryKey) === category.categoryKey
      );
      return [{
        id: category.id,
        key: category.categoryKey,
        name: category.name,
        ...categoryEditorialKeys(projectSlug, category.id, category.categoryKey),
        styleKey: null,
        bedrooms: category.bedrooms,
        unitCount: units.length,
        fromNightlyThb: units.some(unit => unit.bookable) && category.baseNightlyThb > 0 ? category.baseNightlyThb : null,
        monthlyFromThb: null,
        coverUrl: categoryMedia.ready ? categoryMedia.coverUrl : null,
        galleryUrls: categoryMedia.ready ? categoryMedia.urls : [],
        videoUrls: categoryMedia.ready ? categoryMedia.videoUrls : [],
      }];
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
  sleepingSpaces?: PublicSleepingSpace[];
  descriptionKey: string | null;
  minNights: number;
  galleryUrls: string[];
  videoUrls?: string[];
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
  // Inquiry-only inventory is served by listPublicDiscoveryUnits on the unit page.
  // This reader powers the priced booking widget and must retain strict live gates.
  const excludedIds = await allExcludedSourceControlledUnitIds(prisma);
  const unit = await prisma.unit.findFirst({
    where: {
      ...publicStayUnitWhere(excludedIds),
      id: { equals: id, ...(excludedIds.length ? { notIn: excludedIds } : {}) },
      project: { status: 'live' },
    },
    include: {
      sleepingSpaces: PUBLIC_SLEEPING_SPACES_QUERY,
      coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
      media: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
      },
      inventoryCategory: {
        select: {
          categoryKey: true,
          baseNightlyThb: true,
          minNights: true,
          status: true,
          coverMediaId: true,
          coverMedia: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } },
          galleryMedia: {
            orderBy: { sort: 'asc' },
            include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
          },
        },
      },
      project: {
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
          projectType: true,
        },
      },
    },
  });

  if (
    !unit ||
    unit.status !== 'live' ||
    unit.assetStatus === 'suspended' ||
    unit.project.status !== 'live' ||
    unit.inventoryCategory?.status !== 'live'
  ) return null;

  const media = assessUnitMediaReadiness({
    projectType: unit.project.projectType,
    accommodationType: unit.accommodationType,
    unitCoverMediaId: unit.coverMediaId,
    unitMedia: unit.media,
    categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
    categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
  });
  if (!media.ready) return null;

  return {
    sleepingSpaces: publicSleepingSpaces(unit.sleepingSpaces),
    id: unit.id,
    name: unit.name,
    titleKey: unit.descriptionKey ? unit.descriptionKey.replace(/\.description$/, '.title') : null,
    descriptionKey: unit.descriptionKey,
    unitType: unit.unitType,
    categoryKey: unit.inventoryCategory?.categoryKey ?? unit.categoryKey,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    maxGuests: unit.maxGuests,
    sizeSqm: unit.sizeSqm,
    usableAreaSqm: unit.usableAreaSqm === null ? null : Number(unit.usableAreaSqm),
    grossAreaSqm: unit.grossAreaSqm === null ? null : Number(unit.grossAreaSqm),
    outdoorAreaSqm: unit.outdoorAreaSqm === null ? null : Number(unit.outdoorAreaSqm),
    plotAreaSqm: unit.plotAreaSqm === null ? null : Number(unit.plotAreaSqm),
    unitFeatures: unit.unitFeatures,
    views: unit.views,
    baseNightlyThb: unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
    instantBook: unit.instantBook,
    coverUrl: media.coverUrl,
    galleryUrls: media.urls,
    videoUrls: media.videoUrls,
    photoScope: media.photoScope === 'room_type' ? 'room_type' : 'exact_unit',
    mediaReady: true,
    bookable: true,
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
  const [excludedIds, managedImported] = await Promise.all([
    allExcludedSourceControlledUnitIds(prisma),
    managedImportedInventoryIds(prisma),
  ]);
  const units = await prisma.unit.findMany({
    where: {
      ...publicStayUnitWhere(excludedIds, managedImported.unitIds),
      project: {
        OR: [
          { status: 'live' },
          ...(managedImported.projectIds.length
            ? [{ status: 'draft' as const, id: { in: managedImported.projectIds } }]
            : []),
        ],
      },
    },
    select: {
      id: true,
      accommodationType: true,
      coverMediaId: true,
      project: { select: { projectType: true } },
      media: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
      },
      inventoryCategory: {
        select: {
          coverMediaId: true,
          galleryMedia: {
            orderBy: { sort: 'asc' },
            include: { media: { select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } } },
          },
        },
      },
    },
  });
  return units
    .filter((unit) => assessUnitMediaReadiness({
      projectType: unit.project.projectType,
      accommodationType: unit.accommodationType,
      unitCoverMediaId: unit.coverMediaId,
      unitMedia: unit.media,
      categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
      categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
    }).ready)
    .map((unit) => unit.id);
}
