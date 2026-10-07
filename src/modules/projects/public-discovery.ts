import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { managedImportedInventoryIds } from './public-managed-import';
import { assessUnitMediaReadiness } from '@/modules/media/public-readiness';

/** Visibility is not a quote or permission to book. Never publish arbitrary drafts. */
export function discoveryVisibility(ids: { unitIds: string[]; projectIds: string[] }): Prisma.UnitWhereInput {
  return {
    assetStatus: { not: 'suspended' },
    OR: [{ status: 'live' }, { status: 'draft', id: { in: ids.unitIds } }],
    project: { OR: [{ status: 'live' }, { status: 'draft', id: { in: ids.projectIds } }] },
  };
}
const photo = { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true } as const;

export async function listPublicDiscoveryUnits(filters: {
  unitId?: string; projectId?: string; areaSlug?: string; inventoryCategoryId?: string;
  bedrooms?: number; unitTypes?: Array<'villa' | 'condo' | 'townhouse'>;
} = {}) {
  const imported = await managedImportedInventoryIds(prisma);
  const units = await prisma.unit.findMany({
    where: { AND: [discoveryVisibility(imported), {
      ...(filters.bedrooms !== undefined ? { bedrooms: filters.bedrooms } : {}),
      ...(filters.unitTypes?.length ? { unitType: { in: filters.unitTypes } } : {}),
      ...(filters.unitId ? { id: filters.unitId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.areaSlug ? { project: { area: { slug: filters.areaSlug } } } : {}),
      ...(filters.inventoryCategoryId ? { inventoryCategoryId: filters.inventoryCategoryId } : {}),
    }] },
    select: {
      id: true, name: true, descriptionKey: true, bedrooms: true, bathrooms: true,
      maxGuests: true, sizeSqm: true, grossAreaSqm: true, coverMediaId: true, accommodationType: true,
      project: { select: { id: true, slug: true, name: true, projectType: true, area: { select: { slug: true } } } },
      media: { orderBy: { sort: 'asc' }, include: { media: { select: photo } } },
      inventoryCategory: { select: { id: true, name: true, categoryKey: true, coverMediaId: true,
        galleryMedia: { orderBy: { sort: 'asc' }, include: { media: { select: photo } } } } },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    take: filters.unitId ? 1 : 200,
  });
  return units.map(unit => {
    const media = assessUnitMediaReadiness({
      projectType: unit.project.projectType, accommodationType: unit.accommodationType,
      unitCoverMediaId: unit.coverMediaId, unitMedia: unit.media,
      categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
      categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
    });
    return {
      id: unit.id, name: unit.name, descriptionKey: unit.descriptionKey,
      bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, maxGuests: unit.maxGuests,
      sizeSqm: unit.grossAreaSqm === null ? unit.sizeSqm : Number(unit.grossAreaSqm),
      project: { id: unit.project.id, slug: unit.project.slug, name: unit.project.name, areaSlug: unit.project.area?.slug ?? null },
      categoryId: unit.inventoryCategory?.id ?? null,
      categoryKey: unit.inventoryCategory?.categoryKey ?? null,
      categoryName: unit.inventoryCategory?.name ?? null,
      coverUrl: media.ready ? media.coverUrl : null,
      galleryUrls: media.ready ? media.urls : [],
      photoScope: media.photoScope,
    };
  }).sort((a, b) => Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)));
}
export type PublicDiscoveryUnit = Awaited<ReturnType<typeof listPublicDiscoveryUnits>>[number];
