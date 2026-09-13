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
 * write now links the canonical row whenever one exists. This makes the old
 * string a compatibility alias rather than a second independent truth.
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
    select: { id: true },
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
      baseNightlyThb,
      minNights: minNights || 1,
      instantBook,
      cancellationPolicyKey: cancellationPolicyKey || null,
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

  // If categoryKey is changing, resolve that exact category. If this is an
  // unrelated edit on an older unit, opportunistically repair a missing
  // canonical link from the already-validated legacy key.
  const categoryKeyToResolve =
    categoryKey !== undefined ? categoryKey : unit.inventoryCategoryId ? null : unit.categoryKey;
  const canonicalCategory = await resolveCanonicalInventoryCategory(
    unit.projectId,
    categoryKeyToResolve
  );
  const shouldWriteCanonicalCategory = categoryKey !== undefined || (!unit.inventoryCategoryId && Boolean(unit.categoryKey));

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name !== undefined && { name }),
      ...(unitType !== undefined && { unitType }),
      ...(categoryKey !== undefined && { categoryKey }),
      ...(shouldWriteCanonicalCategory && {
        inventoryCategoryId: categoryKey === null ? null : canonicalCategory?.id ?? null,
      }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(bathrooms !== undefined && { bathrooms }),
      ...(maxGuests !== undefined && { maxGuests }),
      ...(sizeSqm !== undefined && { sizeSqm }),
      ...(floor !== undefined && { floor }),
      ...(addressSupplement !== undefined && { addressSupplement }),
      ...(descriptionKey !== undefined && { descriptionKey }),
      ...(amenityKeys !== undefined && { amenityKeys }),
      ...(baseNightlyThb !== undefined && { baseNightlyThb }),
      ...(minNights !== undefined && { minNights }),
      ...(instantBook !== undefined && { instantBook }),
      ...(cancellationPolicyKey !== undefined && { cancellationPolicyKey }),
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
