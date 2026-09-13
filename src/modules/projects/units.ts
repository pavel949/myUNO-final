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
  inventoryCategoryId?: string;
  /** Compatibility public slug. Resolved to InventoryCategory before write. */
  categoryKey?: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm?: number;
  floor?: string;
  addressSupplement: string;
  descriptionKey?: string;
  amenityKeys?: string[];
  /** Legacy compatibility input for uncategorized draft inventory only. */
  baseNightlyThb?: number;
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
  inventoryCategoryId?: string | null;
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

async function resolveCanonicalInventoryCategory(input: {
  projectId: string;
  inventoryCategoryId?: string | null;
  categoryKey?: string | null;
}) {
  if (input.inventoryCategoryId) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: input.inventoryCategoryId },
    });
    if (!category || category.projectId !== input.projectId) {
      throw new Error('InventoryCategory does not belong to this project');
    }
    return category;
  }

  if (input.categoryKey) {
    const category = await prisma.inventoryCategory.findUnique({
      where: {
        projectId_categoryKey: {
          projectId: input.projectId,
          categoryKey: input.categoryKey,
        },
      },
    });
    if (!category) {
      throw new Error(`InventoryCategory ${input.categoryKey} not found in project`);
    }
    return category;
  }

  return null;
}

function validateCanonicalCommercialAliases(
  category: {
    baseNightlyThb: number;
    minNights: number;
    cancellationPolicyKey: string | null;
  },
  input: {
    baseNightlyThb?: number;
    minNights?: number;
    cancellationPolicyKey?: string | null;
  }
) {
  if (
    input.baseNightlyThb !== undefined &&
    input.baseNightlyThb !== category.baseNightlyThb
  ) {
    throw new Error('Base rate belongs to InventoryCategory/RatePlan, not Unit');
  }
  if (input.minNights !== undefined && input.minNights !== category.minNights) {
    throw new Error('Minimum stay belongs to InventoryCategory/RatePlan, not Unit');
  }
  if (
    input.cancellationPolicyKey !== undefined &&
    input.cancellationPolicyKey !== category.cancellationPolicyKey
  ) {
    throw new Error('Cancellation policy belongs to InventoryCategory/RatePlan, not Unit');
  }
}

export async function createUnit(input: CreateUnitInput) {
  const {
    projectId,
    ownerIdentityId,
    name,
    unitType,
    inventoryCategoryId,
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

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const existing = await prisma.unit.findFirst({ where: { projectId, name } });
  if (existing) throw new Error(`Unit with name "${name}" already exists in this project`);

  if (status === 'live') {
    throw new Error(
      'A unit cannot be created live. Create it as draft, confirm permitted use, then set it live.'
    );
  }

  await assertCatalogKeys(prisma, 'catalog.amenities', input.amenityKeys);
  await assertCatalogKeys(prisma, 'catalog.cancellation_policies', input.cancellationPolicyKey);

  const canonicalCategory = await resolveCanonicalInventoryCategory({
    projectId,
    inventoryCategoryId,
    categoryKey,
  });

  if (canonicalCategory) {
    validateCanonicalCommercialAliases(canonicalCategory, {
      baseNightlyThb,
      minNights,
      cancellationPolicyKey,
    });
  } else if (baseNightlyThb === undefined) {
    throw new Error('Draft unit without InventoryCategory requires a temporary baseNightlyThb');
  }

  const unit = await prisma.unit.create({
    data: {
      projectId,
      inventoryCategoryId: canonicalCategory?.id ?? null,
      ownerIdentityId: ownerIdentityId || null,
      name,
      unitType,
      // Compatibility aliases mirror canonical commercial facts.
      categoryKey: canonicalCategory?.categoryKey ?? categoryKey ?? null,
      bedrooms,
      bathrooms,
      maxGuests,
      sizeSqm: sizeSqm || null,
      floor: floor || null,
      addressSupplement,
      descriptionKey: descriptionKey || null,
      amenityKeys,
      baseNightlyThb: canonicalCategory?.baseNightlyThb ?? baseNightlyThb!,
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
      inventoryCategoryId: canonicalCategory?.id ?? null,
    },
  });
  return unit;
}

export async function getUnit(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: { inventoryCategory: true },
  });
}

export async function listUnits(projectId: string, status?: UnitStatus) {
  return prisma.unit.findMany({
    where: { projectId, ...(status && { status }) },
    include: { inventoryCategory: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateUnit(input: UpdateUnitInput) {
  const {
    unitId,
    name,
    unitType,
    inventoryCategoryId,
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
    include: { inventoryCategory: true },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found`);

  if (status && status !== unit.status && status === 'live' && !unit.permittedUseConfirmedAt) {
    throw new Error('Unit cannot move to live status without permitted use confirmation');
  }

  if (name && name !== unit.name) {
    const existing = await prisma.unit.findFirst({
      where: { projectId: unit.projectId, name, id: { not: unitId } },
    });
    if (existing) throw new Error(`Unit with name "${name}" already exists in this project`);
  }

  await assertCatalogKeys(prisma, 'catalog.amenities', input.amenityKeys);

  const categoryExplicitlyChanged =
    inventoryCategoryId !== undefined || categoryKey !== undefined;
  let targetCategory = unit.inventoryCategory;
  if (categoryExplicitlyChanged) {
    if (inventoryCategoryId === null || categoryKey === null) {
      targetCategory = null;
    } else {
      targetCategory = await resolveCanonicalInventoryCategory({
        projectId: unit.projectId,
        inventoryCategoryId,
        categoryKey,
      });
    }
  }

  if ((status ?? unit.status) === 'live' && !targetCategory) {
    throw new Error('Live unit must have a canonical InventoryCategory');
  }

  if (targetCategory) {
    validateCanonicalCommercialAliases(targetCategory, {
      baseNightlyThb,
      minNights,
      cancellationPolicyKey,
    });
  } else {
    await assertCatalogKeys(prisma, 'catalog.cancellation_policies', cancellationPolicyKey);
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name !== undefined && { name }),
      ...(unitType !== undefined && { unitType }),
      ...(categoryExplicitlyChanged && {
        inventoryCategoryId: targetCategory?.id ?? null,
        categoryKey: targetCategory?.categoryKey ?? null,
        ...(targetCategory
          ? {
              baseNightlyThb: targetCategory.baseNightlyThb,
              minNights: targetCategory.minNights,
              cancellationPolicyKey: targetCategory.cancellationPolicyKey,
            }
          : {}),
      }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(bathrooms !== undefined && { bathrooms }),
      ...(maxGuests !== undefined && { maxGuests }),
      ...(sizeSqm !== undefined && { sizeSqm }),
      ...(floor !== undefined && { floor }),
      ...(addressSupplement !== undefined && { addressSupplement }),
      ...(descriptionKey !== undefined && { descriptionKey }),
      ...(amenityKeys !== undefined && { amenityKeys }),
      ...(!targetCategory && baseNightlyThb !== undefined && { baseNightlyThb }),
      ...(!targetCategory && minNights !== undefined && { minNights }),
      ...(instantBook !== undefined && { instantBook }),
      ...(!targetCategory && cancellationPolicyKey !== undefined && { cancellationPolicyKey }),
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
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new Error(`Unit ${unitId} not found`);

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: { permittedUseConfirmedAt: new Date() },
  });
  await logAudit({
    actorIdentityId,
    action: 'units:confirm_permitted_use',
    entityType: 'Unit',
    entityId: unitId,
    data: { confirmedAt: updated.permittedUseConfirmedAt } as any,
  });
  return updated;
}

export async function getUnitDetail(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: true,
      inventoryCategory: { include: { ratePlans: true } },
      owner: true,
      engagements: { orderBy: { createdAt: 'desc' } },
    },
  });
}
