import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import { assertCatalogKeys } from '@/modules/config';
import { UnitStatus, UnitType } from '@prisma/client';
import { ensureOwnershipRecorded } from './ownership.service';

interface CreateUnitInput {
  projectId: string;
  ownerIdentityId?: string;
  name: string;
  unitType: UnitType;
  categoryKey?: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm?: number;
  floor?: string;
  addressSupplement: string;
  descriptionKey?: string;
  amenityKeys?: string[];
  baseNightlyThb: number;
  minNights?: number;
  instantBook?: boolean;
  cancellationPolicyKey?: string;
  status?: UnitStatus;
  actorIdentityId?: string;
}

interface UpdateUnitInput {
  unitId: string;
  name?: string;
  unitType?: UnitType;
  categoryKey?: string | null;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  sizeSqm?: string | null;
  floor?: string | null;
  addressSupplement?: string;
  descriptionKey?: string | null;
  amenityKeys?: string[];
  baseNightlyThb?: number;
  minNights?: number;
  instantBook?: boolean;
  cancellationPolicyKey?: string | null;
  status?: UnitStatus;
  coverMediaId?: string | null;
  actorIdentityId?: string;
}

/**
 * `InventoryCategory` is the canonical sellable-class entity. `categoryKey`
 * remains on Unit while older search/booking callers are migrated, but every
 * write links the canonical row whenever one exists. Commercial Unit columns
 * mirror the category for compatibility rather than defining a second price.
 */
async function resolveCanonicalInventoryCategory(projectId: string, categoryKey?: string | null) {
  if (!categoryKey) return null;
  return prisma.inventoryCategory.findUnique({
    where: {
      projectId_categoryKey: {
        projectId,
        categoryKey,
      },
    },
    select: {
      id: true,
      baseNightlyThb: true,
      minNights: true,
      cancellationPolicyKey: true,
    },
  });
}

/**
 * Create a new unit.
 * Admin/staff-only action.
 */
export async function createUnit(input: CreateUnitInput) {
  const {
    projectId,
    ownerIdentityId,
    name,
    unitType,
    categoryKey,
    bedrooms,
    bathrooms,
    maxGuests,
    sizeSqm,
    floor,
    addressSupplement,
    descriptionKey,
    amenityKeys = [],
    baseNightlyThb,
    minNights,
    instantBook = true,
    cancellationPolicyKey,
    status = 'draft',
    actorIdentityId,
  } = input;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const existing = await prisma.unit.findFirst({
    where: { projectId, name },
  });

  if (existing) {
    throw new Error(`Unit with name "${name}" already exists in this project`);
  }

  if (status === 'live') {
    throw new Error(
      'A unit cannot be created live. Create it as draft, confirm permitted use, then set it live.'
    );
  }

  await assertCatalogKeys(prisma, 'catalog.amenities', input.amenityKeys);
  await assertCatalogKeys(prisma, 'catalog.cancellation_policies', input.cancellationPolicyKey);
  await assertCatalogKeys(prisma, 'catalog.unit_categories', input.categoryKey, { projectId });

  const canonicalCategory = await resolveCanonicalInventoryCategory(projectId, categoryKey);

  const unit = await prisma.unit.create({
    data: {
      projectId,
      inventoryCategoryId: canonicalCategory?.id ?? null,
      ownerIdentityId: ownerIdentityId || null,
      name,
      unitType,
      categoryKey: categoryKey || null,
      bedrooms,
      bathrooms,
      maxGuests,
      sizeSqm: sizeSqm || null,
      floor: floor || null,
      addressSupplement,
      descriptionKey: descriptionKey || null,
      amenityKeys,
      // Compatibility mirrors. A linked InventoryCategory owns these terms.
      baseNightlyThb: canonicalCategory?.baseNightlyThb ?? baseNightlyThb,
      minNights: canonicalCategory?.minNights ?? minNights ?? 1,
      instantBook,
      cancellationPolicyKey:
        canonicalCategory?.cancellationPolicyKey ?? cancellationPolicyKey ?? null,
      status,
    },
  });

  await ensureOwnershipRecorded(prisma, unit.id);

  await logAudit({
    actorIdentityId,
    action: 'units:create',
    entityType: 'Unit',
    entityId: unit.id,
    data: {
      projectId,
      name,
      status,
      categoryKey: categoryKey || null,
      inventoryCategoryId: canonicalCategory?.id ?? null,
    },
  });

  return unit;
}

export async function getUnit(unitId: string) {
  return await prisma.unit.findUnique({
    where: { id: unitId },
  });
}

export async function listUnits(projectId: string, status?: UnitStatus) {
  return await prisma.unit.findMany({
    where: {
      projectId,
      ...(status && { status }),
    },
    include: {
      inventoryCategory: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a unit.
 * Admin/staff-only action.
 */
export async function updateUnit(input: UpdateUnitInput) {
  const {
    unitId,
    name,
    unitType,
    categoryKey,
    bedrooms,
    bathrooms,
    maxGuests,
    sizeSqm,
    floor,
    addressSupplement,
    descriptionKey,
    amenityKeys,
    baseNightlyThb,
    minNights,
    instantBook,
    cancellationPolicyKey,
    status,
    coverMediaId,
    actorIdentityId,
  } = input;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  if (status && status !== unit.status && status === 'live' && !unit.permittedUseConfirmedAt) {
    throw new Error('Unit cannot move to live status without permitted use confirmation');
  }

  if (name && name !== unit.name) {
    const existing = await prisma.unit.findFirst({
      where: {
        projectId: unit.projectId,
        name,
        id: { not: unitId },
      },
    });

    if (existing) {
      throw new Error(`Unit with name "${name}" already exists in this project`);
    }
  }

  await assertCatalogKeys(prisma, 'catalog.amenities', input.amenityKeys);
  await assertCatalogKeys(prisma, 'catalog.cancellation_policies', input.cancellationPolicyKey);
  await assertCatalogKeys(prisma, 'catalog.unit_categories', input.categoryKey, {
    projectId: unit.projectId,
  });

  // Resolve the resulting category on every update. That keeps the compatibility
  // commercial columns synchronized even when an older caller tries to write a
  // unit-level base/min value directly.
  const effectiveCategoryKey = categoryKey !== undefined ? categoryKey : unit.categoryKey;
  const canonicalCategory = await resolveCanonicalInventoryCategory(
    unit.projectId,
    effectiveCategoryKey
  );
  const shouldWriteCanonicalCategory =
    categoryKey !== undefined || (!unit.inventoryCategoryId && Boolean(unit.categoryKey));
  const effectiveInventoryCategoryId =
    categoryKey === null
      ? null
      : canonicalCategory?.id ?? (categoryKey === undefined ? unit.inventoryCategoryId : null);

  // A live unit must remain canonically priceable, not only pass this check at
  // the moment it first transitions to live. Removing/changing its category is
  // therefore blocked unless the resulting canonical category exists.
  const resultingStatus = status ?? unit.status;
  if (resultingStatus === 'live' && !effectiveInventoryCategoryId) {
    throw new Error('A live unit must have a canonical inventory category');
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name !== undefined && { name }),
      ...(unitType !== undefined && { unitType }),
      ...(categoryKey !== undefined && { categoryKey }),
      ...(shouldWriteCanonicalCategory && {
        inventoryCategoryId: effectiveInventoryCategoryId,
      }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(bathrooms !== undefined && { bathrooms }),
      ...(maxGuests !== undefined && { maxGuests }),
      ...(sizeSqm !== undefined && { sizeSqm }),
      ...(floor !== undefined && { floor }),
      ...(addressSupplement !== undefined && { addressSupplement }),
      ...(descriptionKey !== undefined && { descriptionKey }),
      ...(amenityKeys !== undefined && { amenityKeys }),
      // When a canonical category exists, Unit commercial fields are mirrors;
      // explicit unit-level pricing belongs in RatePlan/PricingRule instead.
      ...(canonicalCategory
        ? {
            baseNightlyThb: canonicalCategory.baseNightlyThb,
            minNights: canonicalCategory.minNights,
            cancellationPolicyKey: canonicalCategory.cancellationPolicyKey,
          }
        : {
            ...(baseNightlyThb !== undefined && { baseNightlyThb }),
            ...(minNights !== undefined && { minNights }),
            ...(cancellationPolicyKey !== undefined && { cancellationPolicyKey }),
          }),
      ...(instantBook !== undefined && { instantBook }),
      ...(status !== undefined && { status }),
      ...(coverMediaId !== undefined && { coverMediaId }),
    } as any,
  });

  await logAudit({
    actorIdentityId,
    action: 'units:update',
    entityType: 'Unit',
    entityId: unitId,
    data: {
      before: unit,
      after: updated,
      changedFields: Object.keys(input).filter((k) => k !== 'unitId' && k !== 'actorIdentityId'),
    } as any,
  });

  return updated;
}

export async function confirmPermittedUse(unitId: string, actorIdentityId?: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      permittedUseConfirmedAt: new Date(),
    },
  });

  await logAudit({
    actorIdentityId,
    action: 'units:confirm_permitted_use',
    entityType: 'Unit',
    entityId: unitId,
    data: {
      confirmedAt: updated.permittedUseConfirmedAt,
    } as any,
  });

  return updated;
}

export async function getUnitDetail(unitId: string) {
  return await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: true,
      inventoryCategory: true,
      owner: true,
      engagements: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
