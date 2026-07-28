import { PrismaClient } from '@prisma/client';
import { getConfig } from './config.service';
import type { CatalogEntry } from './types';

/**
 * Catalog-key validation (doc 04 §8). Every write that stores a taxonomy
 * key — amenities, service categories, ticket categories, cancellation
 * policies — must pass through here, so free-text keys can never enter the
 * database and every stored key has a label slot in the content layer
 * (catalog.<name>.<key>.label, doc 05 §4).
 */

export type CatalogName =
  | 'catalog.amenities'
  | 'catalog.service_categories'
  | 'catalog.ticket_categories'
  | 'catalog.unit_types'
  | 'catalog.unit_categories'
  | 'catalog.cancellation_policies';

export async function getCatalogKeys(
  db: PrismaClient,
  catalog: CatalogName,
  scope?: { projectId?: string; unitId?: string }
): Promise<string[]> {
  const entries = ((await getConfig(db, catalog, scope)) ?? []) as CatalogEntry[];
  return entries.map((e) => e.key);
}

/**
 * Throw when any of `values` is not a key of the named catalog.
 * Accepts a single key or an array; empty/undefined passes (a unit with no
 * amenities is legal — a unit with a made-up amenity is not).
 */
export async function assertCatalogKeys(
  db: PrismaClient,
  catalog: CatalogName,
  values: string | string[] | null | undefined,
  scope?: { projectId?: string; unitId?: string }
): Promise<void> {
  if (values === null || values === undefined) return;
  const list = Array.isArray(values) ? values : [values];
  if (list.length === 0) return;

  const entries = (await getConfig(db, catalog, scope)) as CatalogEntry[] | undefined;
  // Catalog not seeded at all = bootstrap state (fresh dev/test database),
  // not a typo — validation applies once the catalog exists, which seeding
  // guarantees in every deployed environment.
  if (!Array.isArray(entries) || entries.length === 0) return;

  const known = new Set(entries.map((e) => e.key));
  const unknown = list.filter((v) => !known.has(v));
  if (unknown.length > 0) {
    throw new Error(`Unknown ${catalog} key(s): ${unknown.join(', ')}`);
  }
}
