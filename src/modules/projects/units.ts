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
  categoryKey?: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm?: number;
  floor?: string;
  addressSupplement: string;
  descriptionKey?: string;
  amenityKeys?: string[];
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
    return prisma.inventoryCategory.findUnique({
      where: {
        projectId_categoryKey: {
          projectId: input.projectId,
          categoryKey: input.categoryKey,
        },
      },
    });
  }

  return null;
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
  if (!inventoryCategoryId) {
    await assertCatalogKeys(prisma, 'catalog.unit_categories', input.categoryKey, { projectId });
  }

  const category = await resolveCanonicalInventoryCategory({
    projectId,
    inventoryCategoryId,
    categoryKey,
  });

  if (inventoryCategoryId && !category) throw new Error('InventoryCategory not found');
  if (!category && baseNightlyThb === undefined) {
    throw new Error('A draft unit without InventoryCategory requires baseNightlyThb');
  }

  const unit = await prisma.unit.create({
    data: {
      projectId,
      inventoryCategoryId: category?.id ?? null,
      ownerIdentityId: ownerIdentityId || null,
      name,
      unitType,
      categoryKey: category?.categoryKey ?? categoryKey ?? null,
      bedrooms,
      bathrooms,
      maxGuests,
      sizeSqm: sizeSqm || null,
      floor: floor || null,
      addressSupplement,
      descriptionKey: descriptionKey || null,
      amenityKeys,
      baseNightlyThb: category?.baseNightlyThb ?? baseNightlyThb!,
      minNights: category?.minNights ?? minNights ?? 1,
      instantBook,
      cancellationPolicyKey:
        category?.cancellationPolicyKey ?? cancellationPolicyKey ?? null,
      status,
    },
  });

  await ensureOwnershipRecorded(prisma, unit.id);
  await logAudit({
    actorIdentityId,
    action: 'units:create',
    entityType: 'Unit',
    entityId: unit.id,
    data: { projectId, name, status, inventoryCategoryId: category?.id ?? null },
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
  await assertCatalogKeys(prisma, 'catalog.cancellation_policies', input.cancellationPolicyKey);

  const categoryChanged = inventoryCategoryId !== undefined || categoryKey !== undefined;
  let category = unit.inventoryCategory;
  if (categoryChanged) {
    if (inventoryCategoryId === null || categoryKey === null) {
      category = null;
    } else {
      category = await resolveCanonicalInventoryCategory({
        projectId: unit.projectId,
        inventoryCategoryId,
        categoryKey,
      });
      if ((inventoryCategoryId || categoryKey) && !category) {
        throw new Error('InventoryCategory not found in this project');
      }
    }
  }

  if ((status ?? unit.status) === 'live' && !category) {
    throw new Error('Live unit must have a canonical InventoryCategory');
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name !== undefined && { name }),
      ...(unitType !== undefined && { unitType }),
      ...(categoryChanged && {
        inventoryCategoryId: category?.id ?? null,
        categoryKey: category?.categoryKey ?? null,
        ...(category
          ? {
              baseNightlyThb: category.baseNightlyThb,
              minNights: category.minNights,
              cancellationPolicyKey: category.cancellationPolicyKey,
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
      ...(!category && baseNightlyThb !== undefined && { baseNightlyThb }),
      ...(!category && minNights !== undefined && { minNights }),
      ...(instantBook !== undefined && { instantBook }),
      ...(!category && cancellationPolicyKey !== undefined && { cancellationPolicyKey }),
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
      changedFields: Object.keys(input).filter((key) => key !== 'unitId' && key !== 'actorIdentityId'),
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
