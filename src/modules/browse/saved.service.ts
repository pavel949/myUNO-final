import { PrismaClient, Prisma } from '@prisma/client';

export interface SaveUnitInput {
  identityId: string;
  unitId: string;
  collection?: string | null;
  note?: string;
}

export async function saveUnit(db: PrismaClient, input: SaveUnitInput) {
  const { identityId, unitId, collection = null, note } = input;
  const existing = await db.savedUnit.findFirst({
    where: { identityId, unitId, collection },
  });
  if (existing) {
    return note !== undefined
      ? db.savedUnit.update({ where: { id: existing.id }, data: { note } })
      : existing;
  }
  return db.savedUnit.create({ data: { identityId, unitId, collection, note } });
}

export async function unsaveUnit(
  db: PrismaClient,
  identityId: string,
  unitId: string,
  collection: string | null = null
): Promise<{ removed: number }> {
  const { count } = await db.savedUnit.deleteMany({
    where: { identityId, unitId, collection },
  });
  return { removed: count };
}

/** Saved cards expose compatibility price/category fields derived canonically. */
export async function listSavedUnits(
  db: PrismaClient,
  identityId: string,
  collection?: string | null
) {
  const rows = await db.savedUnit.findMany({
    where: {
      identityId,
      ...(collection !== undefined ? { collection } : {}),
      unit: { status: { in: ['live', 'mobilizing'] } },
    },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          projectId: true,
          bedrooms: true,
          maxGuests: true,
          coverMediaId: true,
          coverMedia: { select: { storageKey: true } },
          inventoryCategory: {
            select: {
              id: true,
              categoryKey: true,
              name: true,
              baseNightlyThb: true,
              minNights: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    ...row,
    unit: {
      ...row.unit,
      categoryKey: row.unit.inventoryCategory?.categoryKey ?? null,
      baseNightlyThb: row.unit.inventoryCategory?.baseNightlyThb ?? 0,
    },
  }));
}

export async function listSavedCollections(db: PrismaClient, identityId: string) {
  const rows = await db.savedUnit.groupBy({
    by: ['collection'],
    where: { identityId },
    _count: { _all: true },
  });
  return rows.map((r) => ({ collection: r.collection, count: r._count._all }));
}

export interface SearchCriteria {
  projectId?: string;
  /** Canonical relation. */
  categoryId?: string;
  /** Compatibility public slug for old saved searches. */
  categoryKey?: string;
  minBedrooms?: number;
  maxNightlyThb?: number;
  minGuests?: number;
  amenityKeys?: string[];
}

export async function saveSearch(
  db: PrismaClient,
  input: { identityId: string; name?: string; criteria: SearchCriteria; alertsEnabled?: boolean }
) {
  let criteria = input.criteria;
  if (!criteria.categoryId && criteria.projectId && criteria.categoryKey) {
    const category = await db.inventoryCategory.findUnique({
      where: {
        projectId_categoryKey: {
          projectId: criteria.projectId,
          categoryKey: criteria.categoryKey,
        },
      },
      select: { id: true },
    });
    if (category) criteria = { ...criteria, categoryId: category.id };
  }

  return db.savedSearch.create({
    data: {
      identityId: input.identityId,
      name: input.name,
      criteria: criteria as unknown as Prisma.InputJsonValue,
      alertsEnabled: input.alertsEnabled ?? true,
    },
  });
}

export async function listSavedSearches(db: PrismaClient, identityId: string) {
  return db.savedSearch.findMany({ where: { identityId }, orderBy: { createdAt: 'desc' } });
}

export async function deleteSavedSearch(
  db: PrismaClient,
  identityId: string,
  savedSearchId: string
): Promise<{ removed: number }> {
  const { count } = await db.savedSearch.deleteMany({
    where: { id: savedSearchId, identityId },
  });
  return { removed: count };
}

export interface MatchableUnit {
  projectId: string;
  categoryId: string | null;
  categoryKey: string | null;
  bedrooms: number;
  maxGuests: number;
  /** Canonical category/effective rate supplied by caller. */
  baseNightlyThb: number;
  amenityKeys: string[];
}

export function matchesSavedSearch(criteria: SearchCriteria, unit: MatchableUnit): boolean {
  if (criteria.projectId && criteria.projectId !== unit.projectId) return false;
  if (criteria.categoryId && criteria.categoryId !== unit.categoryId) return false;
  if (!criteria.categoryId && criteria.categoryKey && criteria.categoryKey !== unit.categoryKey) {
    return false;
  }
  if (criteria.minBedrooms !== undefined && unit.bedrooms < criteria.minBedrooms) return false;
  if (criteria.minGuests !== undefined && unit.maxGuests < criteria.minGuests) return false;
  if (criteria.maxNightlyThb !== undefined && unit.baseNightlyThb > criteria.maxNightlyThb) {
    return false;
  }
  if (criteria.amenityKeys?.length) {
    const has = new Set(unit.amenityKeys);
    if (!criteria.amenityKeys.every((key) => has.has(key))) return false;
  }
  return true;
}

export async function findSearchesMatching(
  db: PrismaClient,
  unit: MatchableUnit & { id: string }
) {
  const searches = await db.savedSearch.findMany({ where: { alertsEnabled: true } });
  return searches.filter((search) =>
    matchesSavedSearch(search.criteria as unknown as SearchCriteria, unit)
  );
}
