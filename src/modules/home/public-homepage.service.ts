import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { listPublicProjects } from '@/modules/projects';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { listBrowsableAreas } from '@/modules/projects/area.service';
import { listPublicMarketplaceServices } from '@/modules/services';
import { allExcludedSourceControlledUnitIds } from '@/modules/booking/source-authority';
import { tMany, type Locale } from '@/modules/content';
import { interleaveByProject, rankProjects } from './home-read-model';
import { applyHomepagePlacements } from './homepage-placement';
import { getDestination } from '@/modules/destinations';

export interface HomepageStayUnit {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyThb: number;
  coverUrl: string | null;
  project: { id: string; slug: string; name: string; areaSlug: string | null };
  categoryName: string | null;
}

export interface HomepageArea {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  projectCount: number;
  coverUrl: string | null;
}

async function readHomepageData(locale: Locale) {
  const excludedIds = await allExcludedSourceControlledUnitIds(prisma);
  const destination = getDestination();

  const [projects, commercialHomes, services, rawAreas, units, areaCoverProjects, placements] = await Promise.all([
    listPublicProjects(locale),
    listPublicCommercialHomes(prisma),
    listPublicMarketplaceServices(prisma, locale, { limit: 24 }).catch(() => []),
    listBrowsableAreas(prisma),
    prisma.unit.findMany({
      where: {
        status: 'live',
        assetStatus: { not: 'suspended' },
        id: excludedIds.length ? { notIn: excludedIds } : undefined,
        project: { status: 'live' },
        inventoryCategory: { status: 'live' },
        OR: [
          { project: { projectType: null } },
          {
            commercialOfferings: {
              some: {
                offeringType: { in: ['short_term_stay', 'short_stay'] },
                status: 'active',
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        baseNightlyThb: true,
        coverMedia: { select: { storageKey: true } },
        media: {
          take: 1,
          orderBy: { sort: 'asc' },
          select: { media: { select: { storageKey: true } } },
        },
        project: { select: { id: true, slug: true, name: true, area: { select: { slug: true } } } },
        inventoryCategory: {
          select: {
            name: true,
            baseNightlyThb: true,
            coverMedia: { select: { storageKey: true } },
          },
        },
      },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
      // Wide read; the shelf is chosen below so one project cannot fill it.
      take: 48,
    }),
    prisma.project.findMany({
      where: { status: 'live', areaId: { not: null } },
      select: {
        areaId: true,
        coverMedia: { select: { storageKey: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.homepagePlacement.findMany({
      where: {
        destinationKey: destination.key,
        status: 'active',
        OR: [{ locale: null }, { locale }],
      },
      orderBy: [{ sectionKey: 'asc' }, { position: 'asc' }],
    }).catch((error) => {
      console.error('[homepage] placement layer unavailable; using canonical fallback ordering', error);
      return [];
    }),
  ]);

  const areaKeys = rawAreas.flatMap(area => [
    area.nameKey,
    ...(area.descriptionKey ? [area.descriptionKey] : []),
  ]);
  const areaCopy = areaKeys.length ? await tMany(prisma, areaKeys, locale) : {};
  const areaCoverById = new Map<string, string>();
  for (const project of areaCoverProjects) {
    if (project.areaId && project.coverMedia?.storageKey && !areaCoverById.has(project.areaId)) {
      areaCoverById.set(project.areaId, project.coverMedia.storageKey);
    }
  }

  const allStayUnits: HomepageStayUnit[] = units.map(unit => ({
    id: unit.id,
    name: unit.name,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    maxGuests: unit.maxGuests,
    baseNightlyThb: unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
    coverUrl:
      unit.coverMedia?.storageKey ??
      unit.media[0]?.media.storageKey ??
      unit.inventoryCategory?.coverMedia?.storageKey ??
      null,
    project: { id: unit.project.id, slug: unit.project.slug, name: unit.project.name, areaSlug: unit.project.area?.slug ?? null },
    categoryName: unit.inventoryCategory?.name ?? null,
  }));
  const stayUnits = interleaveByProject(
    allStayUnits.map(unit => ({ ...unit, projectId: unit.project.id })),
    8
  );

  const allAreas: HomepageArea[] = rawAreas.map(area => ({
    id: area.id,
    slug: area.slug,
    displayName: areaCopy[area.nameKey] || area.slug,
    description: area.descriptionKey ? areaCopy[area.descriptionKey] || '' : '',
    projectCount: area.projectCount,
    coverUrl: areaCoverById.get(area.id) ?? null,
  }));

  const rankedProjects = rankProjects(projects);
  const placedProjects = applyHomepagePlacements(rankedProjects, placements, {
    destinationKey: destination.key,
    locale,
    sectionKey: 'projects',
    entityType: 'project',
  });
  const placedCommercialHomes = applyHomepagePlacements(commercialHomes, placements, {
    destinationKey: destination.key,
    locale,
    sectionKey: 'homes',
    entityType: 'unit',
  });
  const placedStayUnits = applyHomepagePlacements(stayUnits, placements, {
    destinationKey: destination.key,
    locale,
    sectionKey: 'homes',
    entityType: 'unit',
  });
  const placedServices = applyHomepagePlacements(services, placements, {
    destinationKey: destination.key,
    locale,
    sectionKey: 'services',
    entityType: 'service',
  });
  const placedAreas = applyHomepagePlacements(allAreas, placements, {
    destinationKey: destination.key,
    locale,
    sectionKey: 'areas',
    entityType: 'area',
  });

  return {
    projects: placedProjects,
    commercialHomes: placedCommercialHomes,
    services: placedServices,
    stayUnits: placedStayUnits,
    /** Areas shown as cards (first six); `placeAreas` feeds the search box. */
    areas: placedAreas.slice(0, 6),
    placeAreas: allAreas,
  };
}

/**
 * Public discovery content changes much less frequently than availability.
 * Cache only the marketing/read models; dated search and booking remain live.
 */
export const getPublicHomepageData = unstable_cache(
  readHomepageData,
  ['public-homepage-v4'],
  { revalidate: 60, tags: ['public-homepage'] }
);
