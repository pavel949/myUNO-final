import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { listPublicProjects } from '@/modules/projects';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { listBrowsableAreas } from '@/modules/projects/area.service';
import { listPublicMarketplaceServices } from '@/modules/services';
import { allExcludedSourceControlledUnitIds } from '@/modules/booking/source-authority';
import { tMany, type Locale } from '@/modules/content';

export interface HomepageStayUnit {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyThb: number;
  coverUrl: string | null;
  project: { id: string; slug: string; name: string };
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

  const [projects, commercialHomes, services, rawAreas, units, areaCoverProjects] = await Promise.all([
    listPublicProjects(locale),
    listPublicCommercialHomes(prisma),
    listPublicMarketplaceServices(prisma, locale, { limit: 8 }).catch(() => []),
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
        project: { select: { id: true, slug: true, name: true } },
        inventoryCategory: {
          select: {
            name: true,
            baseNightlyThb: true,
            coverMedia: { select: { storageKey: true } },
          },
        },
      },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
      take: 8,
    }),
    prisma.project.findMany({
      where: { status: 'live', areaId: { not: null } },
      select: {
        areaId: true,
        coverMedia: { select: { storageKey: true } },
      },
      orderBy: { createdAt: 'asc' },
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

  const stayUnits: HomepageStayUnit[] = units.map(unit => ({
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
    project: unit.project,
    categoryName: unit.inventoryCategory?.name ?? null,
  }));

  const areas: HomepageArea[] = rawAreas.slice(0, 6).map(area => ({
    id: area.id,
    slug: area.slug,
    displayName: areaCopy[area.nameKey] || area.slug,
    description: area.descriptionKey ? areaCopy[area.descriptionKey] || '' : '',
    projectCount: area.projectCount,
    coverUrl: areaCoverById.get(area.id) ?? null,
  }));

  return { projects, commercialHomes, services, stayUnits, areas };
}

/**
 * Public discovery content changes much less frequently than availability.
 * Cache only the marketing/read models; dated search and booking remain live.
 */
export const getPublicHomepageData = unstable_cache(
  readHomepageData,
  ['public-homepage-v2'],
  { revalidate: 60, tags: ['public-homepage'] }
);
