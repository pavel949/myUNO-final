import type { PrismaClient } from '@prisma/client';
import { logAudit } from '@/modules/audit';
import { getConfig, setConfigOverride } from '@/modules/config';
import { ensureContentKey } from '@/modules/content';

/**
 * Inventory categories and their rate plans — the write path the canonical
 * commercial model was missing.
 *
 * `InventoryCategory` is the sellable class (a hotel's room type, a villa
 * estate's "3BR Pool Villa") and `RatePlan` is its tariff. Three separate
 * places already refuse a live unit that has no category: `updateUnit`,
 * `computeCanonicalPriceBreakdown`, and the `unit_inventory_category_coherence`
 * trigger installed by 20260913210000_canonical_inventory_bootstrap.
 *
 * Nothing created one. The bootstrap migration backfilled a row per distinct
 * unit profile that existed when it ran, and after that the only way to get a
 * category was to write SQL — so every unit created through the product since
 * has been permanently stuck in draft. The repository's own
 * `units.integration.test.ts` ("allows going live after permitted use is
 * confirmed") has been failing on `main` for exactly this reason, unnoticed
 * because CI has not run since 7 September.
 *
 * Three invariants this module holds, because the rest of the system assumes
 * them and nothing else was enforcing them:
 *
 *  1. **Every category has an active BAR rate plan.** `resolveBarPlan`
 *     (canonical-pricing.service.ts) walks unit → category → project looking
 *     for `code: 'BAR'`; a category without one silently falls through to the
 *     project plan or to no plan at all. Creation makes both rows in one
 *     transaction, so the pair cannot come apart.
 *  2. **The key is registered in `catalog.unit_categories` for the project.**
 *     `createUnit`/`updateUnit` run `assertCatalogKeys` against that config
 *     before they will attach a unit to a category key. A category whose key
 *     is not in the catalog is a category no unit can join — the second half
 *     of the same deadlock. Creation registers the key as a project-scoped
 *     config override (doc 04 §8).
 *  3. **The label is a content key, not a column.** Search renders
 *     `catalog.unit_categories.<key>.label` through `t()`. Creation registers
 *     the key so the admin content editor can see it; the copy itself stays an
 *     unfilled `needs_review` draft for the founder (doc 05 §1, CLAUDE.md).
 *
 * Money is satang throughout, like every other amount in the system.
 */

export interface CreateInventoryCategoryInput {
  projectId: string;
  categoryKey: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyThb: number;
  minNights?: number;
  cancellationPolicyKey?: string | null;
  actorIdentityId: string;
}

export interface UpdateInventoryCategoryInput {
  categoryId: string;
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  baseNightlyThb?: number;
  minNights?: number;
  cancellationPolicyKey?: string | null;
  status?: 'live' | 'archived';
  actorIdentityId: string;
}

/** snake_case, matching the `catalog.unit_categories` validator in doc 04 §8. */
const CATEGORY_KEY_SHAPE = /^[a-z0-9_]+$/;

function assertCommercialTerms(input: {
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  baseNightlyThb?: number;
  minNights?: number;
}): void {
  const { bedrooms, bathrooms, maxGuests, baseNightlyThb, minNights } = input;

  if (bedrooms !== undefined && (!Number.isInteger(bedrooms) || bedrooms < 0)) {
    throw new Error('bedrooms must be a non-negative integer');
  }
  if (bathrooms !== undefined && (!Number.isInteger(bathrooms) || bathrooms < 0)) {
    throw new Error('bathrooms must be a non-negative integer');
  }
  if (maxGuests !== undefined && (!Number.isInteger(maxGuests) || maxGuests < 1)) {
    throw new Error('maxGuests must be a positive integer');
  }
  // Satang, like every stored amount. A category priced at zero is not a
  // free stay, it is an unfinished category — and it would quote ฿0 to a guest.
  if (
    baseNightlyThb !== undefined &&
    (!Number.isInteger(baseNightlyThb) || baseNightlyThb < 1)
  ) {
    throw new Error('baseNightlyThb must be a positive integer in satang');
  }
  if (minNights !== undefined && (!Number.isInteger(minNights) || minNights < 1)) {
    throw new Error('minNights must be a positive integer');
  }
}

/**
 * Register the category key in the project's `catalog.unit_categories`, so
 * `assertCatalogKeys` will let a unit join it.
 *
 * Read through `getConfig` with the project scope and written back as a
 * project override: the global default is `[]`, and one project's room types
 * are not another's.
 */
async function registerCategoryKeyInCatalog(
  db: PrismaClient,
  projectId: string,
  entry: { key: string; bedrooms: number },
  actorIdentityId: string
): Promise<void> {
  const current = ((await getConfig(db, 'catalog.unit_categories', { projectId })) ??
    []) as Array<{ key: string; bedrooms?: number; style_key?: string }>;

  const existing = current.find((item) => item.key === entry.key);
  const next = existing
    ? current.map((item) =>
        item.key === entry.key ? { ...item, bedrooms: entry.bedrooms } : item
      )
    : [...current, { key: entry.key, bedrooms: entry.bedrooms }];

  await setConfigOverride(db, 'catalog.unit_categories', next, {
    scopeType: 'project',
    scopeId: projectId,
    changedByIdentityId: actorIdentityId,
  });
}

/**
 * Create a sellable category and its BAR rate plan.
 *
 * The category row, its BAR plan and the catalog registration are one
 * transaction: a half-made category is worse than none, because the parts that
 * refuse a live unit would each see a different answer.
 */
export async function createInventoryCategory(
  db: PrismaClient,
  input: CreateInventoryCategoryInput
) {
  const {
    projectId,
    categoryKey,
    name,
    bedrooms,
    bathrooms,
    maxGuests,
    baseNightlyThb,
    minNights = 1,
    cancellationPolicyKey = null,
    actorIdentityId,
  } = input;

  if (!CATEGORY_KEY_SHAPE.test(categoryKey)) {
    throw new Error('categoryKey must be snake_case (a-z, 0-9, underscore)');
  }
  if (!name.trim()) {
    throw new Error('name is required');
  }
  assertCommercialTerms({ bedrooms, bathrooms, maxGuests, baseNightlyThb, minNights });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const duplicate = await db.inventoryCategory.findUnique({
    where: { projectId_categoryKey: { projectId, categoryKey } },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error(`Category "${categoryKey}" already exists in this project`);
  }

  const category = await db.$transaction(async (tx) => {
    const created = await tx.inventoryCategory.create({
      data: {
        projectId,
        categoryKey,
        name: name.trim(),
        bedrooms,
        bathrooms,
        maxGuests,
        baseNightlyThb,
        minNights,
        cancellationPolicyKey,
        status: 'live',
      },
    });

    // Invariant 1. `isMaster` marks this as the plan others derive from; the
    // adjustment columns stay null because BAR *is* the base rate, not a
    // markup on one.
    await tx.ratePlan.create({
      data: {
        categoryId: created.id,
        code: 'BAR',
        name: 'Best Available Rate',
        isMaster: true,
        cancellationPolicyKey,
        minNights,
        status: 'active',
      },
    });

    return created;
  });

  // Invariant 2 and 3 sit outside the transaction deliberately: both write
  // through module seams (config override + audit, content key) that own their
  // own writes, and a category that exists with its catalog entry a moment
  // behind is recoverable, whereas a category without its BAR plan is not.
  await registerCategoryKeyInCatalog(db, projectId, { key: categoryKey, bedrooms }, actorIdentityId);

  await ensureContentKey(
    db,
    `catalog.unit_categories.${categoryKey}.label`,
    'catalog',
    `Guest-facing label for the "${name.trim()}" inventory category`
  );

  await logAudit({
    actorIdentityId,
    action: 'inventory_categories:create',
    entityType: 'InventoryCategory',
    entityId: category.id,
    data: { projectId, categoryKey, name: category.name, baseNightlyThb, minNights },
  });

  return category;
}

/**
 * Amend a category's commercial terms.
 *
 * The BAR plan's own `minNights`/`cancellationPolicyKey` follow the category,
 * so the two cannot disagree about the same stay. Units are *not* rewritten
 * here: `updateUnit` already mirrors category terms onto its compatibility
 * columns whenever a unit is saved, and rewriting every unit from this path
 * would make one edit fan out into an unbounded write.
 */
export async function updateInventoryCategory(
  db: PrismaClient,
  input: UpdateInventoryCategoryInput
) {
  const { categoryId, actorIdentityId, status, ...fields } = input;

  assertCommercialTerms(fields);
  if (fields.name !== undefined && !fields.name.trim()) {
    throw new Error('name is required');
  }

  const category = await db.inventoryCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new Error(`Inventory category ${categoryId} not found`);
  }

  // Archiving a category that live units still sell would leave those units
  // pointing at inventory the operator believes is withdrawn.
  if (status === 'archived' && category.status !== 'archived') {
    const liveUnits = await db.unit.count({
      where: { inventoryCategoryId: categoryId, status: 'live' },
    });
    if (liveUnits > 0) {
      throw new Error(
        `Cannot archive: ${liveUnits} live unit(s) still belong to this category. Pause them first.`
      );
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.inventoryCategory.update({
      where: { id: categoryId },
      data: {
        ...(fields.name !== undefined && { name: fields.name.trim() }),
        ...(fields.bedrooms !== undefined && { bedrooms: fields.bedrooms }),
        ...(fields.bathrooms !== undefined && { bathrooms: fields.bathrooms }),
        ...(fields.maxGuests !== undefined && { maxGuests: fields.maxGuests }),
        ...(fields.baseNightlyThb !== undefined && { baseNightlyThb: fields.baseNightlyThb }),
        ...(fields.minNights !== undefined && { minNights: fields.minNights }),
        ...(fields.cancellationPolicyKey !== undefined && {
          cancellationPolicyKey: fields.cancellationPolicyKey,
        }),
        ...(status !== undefined && { status }),
      },
    });

    if (fields.minNights !== undefined || fields.cancellationPolicyKey !== undefined) {
      await tx.ratePlan.updateMany({
        where: { categoryId, code: 'BAR' },
        data: {
          ...(fields.minNights !== undefined && { minNights: fields.minNights }),
          ...(fields.cancellationPolicyKey !== undefined && {
            cancellationPolicyKey: fields.cancellationPolicyKey,
          }),
        },
      });
    }

    return next;
  });

  await logAudit({
    actorIdentityId,
    action: 'inventory_categories:update',
    entityType: 'InventoryCategory',
    entityId: categoryId,
    data: { before: category, after: updated } as never,
  });

  return updated;
}

/**
 * A project's categories, each with its unit count and rate plans — what the
 * admin screen renders and what the unit create form picks from.
 */
export async function listInventoryCategories(db: PrismaClient, projectId: string) {
  return db.inventoryCategory.findMany({
    where: { projectId },
    include: {
      ratePlans: {
        where: { status: 'active' },
        orderBy: [{ isMaster: 'desc' }, { code: 'asc' }],
      },
      _count: { select: { units: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Repair categories left without an active BAR plan.
 *
 * The bootstrap migration created BAR plans for the categories it made, but a
 * category whose plan was later archived prices through whatever the project
 * level happens to offer. Idempotent, so it is safe to call from a screen.
 */
export async function ensureBarRatePlans(
  db: PrismaClient,
  projectId: string,
  actorIdentityId: string
): Promise<number> {
  const categories = await db.inventoryCategory.findMany({
    where: { projectId },
    include: { ratePlans: { where: { code: 'BAR', status: 'active' } } },
  });

  const missing = categories.filter((category) => category.ratePlans.length === 0);
  if (missing.length === 0) return 0;

  await db.$transaction(
    missing.map((category) =>
      db.ratePlan.create({
        data: {
          categoryId: category.id,
          code: 'BAR',
          name: 'Best Available Rate',
          isMaster: true,
          cancellationPolicyKey: category.cancellationPolicyKey,
          minNights: category.minNights,
          status: 'active',
        },
      })
    )
  );

  await logAudit({
    actorIdentityId,
    action: 'inventory_categories:repair_bar_plans',
    entityType: 'Project',
    entityId: projectId,
    data: { repaired: missing.map((c) => c.categoryKey) },
  });

  return missing.length;
}

/**
 * Idempotent create-or-update, for seeds.
 *
 * `createInventoryCategory` refuses a duplicate key, which is right for an
 * operator clicking a button and wrong for a seed that must be re-runnable.
 * This holds the same BAR-plan invariant and returns the row either way. It
 * deliberately does not touch `catalog.unit_categories` or content keys —
 * seeds write both themselves, with their own copy.
 */
export async function ensureInventoryCategory(
  db: PrismaClient,
  input: {
    projectId: string;
    categoryKey: string;
    name: string;
    bedrooms: number;
    bathrooms: number;
    maxGuests: number;
    baseNightlyThb: number;
    minNights?: number;
    cancellationPolicyKey?: string | null;
  }
) {
  const minNights = input.minNights ?? 1;
  const category = await db.inventoryCategory.upsert({
    where: {
      projectId_categoryKey: { projectId: input.projectId, categoryKey: input.categoryKey },
    },
    create: {
      projectId: input.projectId,
      categoryKey: input.categoryKey,
      name: input.name,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      maxGuests: input.maxGuests,
      baseNightlyThb: input.baseNightlyThb,
      minNights,
      cancellationPolicyKey: input.cancellationPolicyKey ?? null,
      status: 'live',
    },
    update: {
      name: input.name,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      maxGuests: input.maxGuests,
      baseNightlyThb: input.baseNightlyThb,
      minNights,
    },
  });

  const bar = await db.ratePlan.findFirst({
    where: { categoryId: category.id, code: 'BAR', status: 'active' },
  });
  if (!bar) {
    await db.ratePlan.create({
      data: {
        categoryId: category.id,
        code: 'BAR',
        name: 'Best Available Rate',
        isMaster: true,
        cancellationPolicyKey: category.cancellationPolicyKey,
        minNights: category.minNights,
        status: 'active',
      },
    });
  }

  return category;
}
