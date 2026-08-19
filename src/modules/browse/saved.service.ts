import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Keeping a villa, and keeping a search.
 *
 * A prospect who browses and leaves has nothing to come back to: no way to hold
 * a villa they liked, no way to hear when one matching what they wanted appears.
 * For a business whose first channel is a relationship rather than a search
 * engine, that is the difference between a conversation continuing and a visit
 * ending.
 *
 * What is deliberately absent: what an alert *does* when a saved search matches
 * — mail at once, digest daily, or say nothing until they return. That is a
 * product decision with a tone and a cadence attached, logged as **Q38** rather
 * than guessed here. `matchesSavedSearch` decides *whether* something matches;
 * the founder decides what happens next.
 */

// --- Saving a villa ------------------------------------------------------

export interface SaveUnitInput {
  identityId: string;
  unitId: string;
  /** Null or omitted puts it in the default list. */
  collection?: string | null;
  note?: string;
}

/**
 * Save a villa. Saving one already saved is not an error — the guest expressed
 * the same intent twice, and failing them for it would be pedantry.
 */
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

/** Remove a save. Removing one that is not there is a no-op, for the same reason. */
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

/**
 * Everything this person saved, newest first.
 *
 * Units that have since been archived or suspended are left out: a list that
 * offers a villa nobody can book is worse than a shorter list.
 */
export async function listSavedUnits(
  db: PrismaClient,
  identityId: string,
  collection?: string | null
) {
  return db.savedUnit.findMany({
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
          baseNightlyThb: true,
          bedrooms: true,
          maxGuests: true,
          coverMediaId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** The named lists this person has, so a picker can offer them. */
export async function listSavedCollections(db: PrismaClient, identityId: string) {
  const rows = await db.savedUnit.groupBy({
    by: ['collection'],
    where: { identityId },
    _count: { _all: true },
  });

  return rows.map((r) => ({ collection: r.collection, count: r._count._all }));
}

// --- Saving a search -----------------------------------------------------

/**
 * The filter set, stored as criteria rather than a query string. A URL shape is
 * a presentation detail, and storing one would tie saved data to the router.
 */
export interface SearchCriteria {
  projectId?: string;
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
  return db.savedSearch.create({
    data: {
      identityId: input.identityId,
      name: input.name,
      criteria: input.criteria as unknown as Prisma.InputJsonValue,
      alertsEnabled: input.alertsEnabled ?? true,
    },
  });
}

export async function listSavedSearches(db: PrismaClient, identityId: string) {
  return db.savedSearch.findMany({
    where: { identityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteSavedSearch(
  db: PrismaClient,
  identityId: string,
  savedSearchId: string
): Promise<{ removed: number }> {
  // Scoped in the delete rather than fetched-then-checked: a saved search is
  // someone's, and deleting by id alone would let anyone remove anyone's.
  const { count } = await db.savedSearch.deleteMany({
    where: { id: savedSearchId, identityId },
  });
  return { removed: count };
}

export interface MatchableUnit {
  projectId: string;
  categoryKey: string | null;
  bedrooms: number;
  maxGuests: number;
  baseNightlyThb: number;
  amenityKeys: string[];
}

/**
 * Whether a unit satisfies a saved search.
 *
 * Pure, so it can be reasoned about and tested without a database, and so the
 * same rule serves both "alert me about this new villa" and "show me what
 * matched". An absent criterion is not a constraint — a search with no price
 * ceiling matches every price, rather than none.
 */
export function matchesSavedSearch(criteria: SearchCriteria, unit: MatchableUnit): boolean {
  if (criteria.projectId && criteria.projectId !== unit.projectId) return false;
  if (criteria.categoryKey && criteria.categoryKey !== unit.categoryKey) return false;
  if (criteria.minBedrooms !== undefined && unit.bedrooms < criteria.minBedrooms) return false;
  if (criteria.minGuests !== undefined && unit.maxGuests < criteria.minGuests) return false;
  if (criteria.maxNightlyThb !== undefined && unit.baseNightlyThb > criteria.maxNightlyThb) {
    return false;
  }
  if (criteria.amenityKeys?.length) {
    // Every requested amenity, not any — a guest who asked for a pool and a cot
    // wants both, and "any" would send them a villa with neither of the two.
    const has = new Set(unit.amenityKeys);
    if (!criteria.amenityKeys.every((key) => has.has(key))) return false;
  }
  return true;
}

/**
 * Saved searches a newly live unit matches, whose owner asked to hear about it.
 *
 * Returns them rather than notifying: what an alert does is Q38, and this
 * function having an opinion about it would be the invention that question
 * exists to prevent.
 */
export async function findSearchesMatching(
  db: PrismaClient,
  unit: MatchableUnit & { id: string }
) {
  const searches = await db.savedSearch.findMany({ where: { alertsEnabled: true } });

  return searches.filter((search) =>
    matchesSavedSearch(search.criteria as unknown as SearchCriteria, unit)
  );
}
