import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { listPublicProjects } from '@/modules/projects';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { listBrowsableAreas } from '@/modules/projects/area.service';
import { listPublicMarketplaceServices } from '@/modules/services';
import { listPublicDiscoveryUnits } from '@/modules/projects/public-discovery';
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
  const destination = getDestination();

  const [projects, commercialHomes, services, rawAreas, units, areaCoverProjects, placements] = await Promise.all([
    listPublicProjects(locale),
    listPublicCommercialHomes(prisma),
    listPublicMarketplaceServices(prisma, locale, { limit: 24 }).catch(() => []),
    listBrowsableAreas(prisma),
    listPublicDiscoveryUnits(),
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

  const allStayUnits: HomepageStayUnit[] = units.filter(unit => unit.coverUrl).map(unit => ({
    ...unit,
    // Browse cards deliberately show terms on request; a base rate is not a quote.
    baseNightlyThb: 0,
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
