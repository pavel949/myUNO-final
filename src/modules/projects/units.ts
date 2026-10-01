import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import { assertCatalogKeys } from '@/modules/config';
import { checkRegulatoryCredentialForGoLive } from '@/modules/compliance';
import { UnitStatus, UnitType } from '@prisma/client';
import { ensureOwnershipRecorded } from './ownership.service';
import { assertUnitReadyForActivation } from './property-readiness';

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
  structureNodeId?: string | null;
  addressSupplement: string;
  descriptionKey?: string;
  amenityKeys?: string[];
  baseNightlyThb: number;
  minNights?: number;
  instantBook?: boolean;
  cancellationPolicyKey?: string;
  status?: UnitStatus;
  actorIdentityId?: string;
  inventoryCategoryId?: string;
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
  structureNodeId?: string | null;
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
  inventoryCategoryId?: string | null;
}

/**
 * `InventoryCategory` is the canonical sellable-class entity. `categoryKey`
 * remains on Unit while older search/booking callers are migrated, but every
 * write links the canonical row whenever one exists. Commercial Unit columns
 * mirror the category for compatibility rather than defining a second price.
 */
async function assertStructureScope(projectId: string, structureNodeId?: string | null) {
  if (!structureNodeId) return;
  const node = await prisma.projectStructureNode.findFirst({
    where: { id: structureNodeId, projectId }, select: { id: true },
  });
  if (!node) throw new Error('Structure node does not belong to this project');
}

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
      categoryKey: true,
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

/**
 * The legacy unit forms (admin Units, ops New unit) create stay inventory in
 * untyped projects: going live there has always meant "bookable". Now that
 * CommercialOffering is the sellability gate for every live unit, keep that
 * meaning explicit by ensuring an active stay offering when such a unit goes
 * live. Typed (canonical onboarding) projects choose their offerings
 * explicitly in onboarding step 5 and are left alone; an existing stay
 * offering in any status is never touched.
 */
async function ensureLegacyStayOffering(unitId: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      status: true,
      project: { select: { projectType: true } },
      commercialOfferings: {
        where: { offeringType: { in: ['short_stay', 'short_term_stay'] } },
        select: { id: true },
      },
    },
  });
  if (!unit || unit.status !== 'live' || unit.project.projectType) return;
  if (unit.commercialOfferings.length > 0) return;
  await prisma.commercialOffering.create({
    data: { unitId, offeringType: 'short_stay', status: 'active' },
  });
}

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
    structureNodeId,
    addressSupplement,
    descriptionKey,
    amenityKeys = [],
    baseNightlyThb,
    minNights,
    instantBook = true,
    cancellationPolicyKey,
    status = 'draft',
    actorIdentityId,
    inventoryCategoryId,
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

  const canonicalCategory = inventoryCategoryId
    ? await prisma.inventoryCategory.findFirst({
        where: { id: inventoryCategoryId, projectId },
        select: {
          id: true,
          categoryKey: true,
          baseNightlyThb: true,
          minNights: true,
          cancellationPolicyKey: true,
        },
      })
    : await resolveCanonicalInventoryCategory(projectId, categoryKey);
  if (inventoryCategoryId && !canonicalCategory) {
    throw new Error('Inventory category does not belong to this project');
  }

  await assertStructureScope(projectId, structureNodeId);

  const unit = await prisma.unit.create({
    data: {
      projectId,
      inventoryCategoryId: canonicalCategory?.id ?? null,
      ownerIdentityId: ownerIdentityId || null,
      name,
      unitType,
      categoryKey: canonicalCategory?.categoryKey ?? categoryKey ?? null,
      bedrooms,
      bathrooms,
      maxGuests,
      sizeSqm: sizeSqm || null,
      floor: floor || null,
      structureNodeId: structureNodeId ?? null,
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
  await ensureLegacyStayOffering(unit.id);

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
    structureNodeId,
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
    inventoryCategoryId,
  } = input;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  if (status && status !== unit.status) {
    if (status === 'live') {
      if (!unit.permittedUseConfirmedAt) {
        throw new Error(
          'Unit cannot move to live status without permitted use confirmation'
        );
      }
      // Independent of the permitted-use check above (Q71 founder ruling,
      // 2026-09-29): a general permitted-use confirmation and an active
      // short-term-rental credential answer different legal questions, and
      // both are required going forward. Only fires on the transition to
      // live, so a unit already selling is never retroactively affected.
      const credentialCheck = await checkRegulatoryCredentialForGoLive(prisma, unitId);
      if (!credentialCheck.ok) {
        throw new Error(credentialCheck.reason);
      }
      await assertUnitReadyForActivation(prisma, unitId);
    }
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
  await assertStructureScope(unit.projectId, structureNodeId);

  // Resolve the resulting category on every update. That keeps the compatibility
  // commercial columns synchronized even when an older caller tries to write a
  // unit-level base/min value directly.
  const effectiveCategoryKey = categoryKey !== undefined ? categoryKey : unit.categoryKey;
  const canonicalCategory = inventoryCategoryId
    ? await prisma.inventoryCategory.findFirst({
        where: { id: inventoryCategoryId, projectId: unit.projectId },
        select: { id: true, categoryKey: true, baseNightlyThb: true, minNights: true, cancellationPolicyKey: true },
      })
    : await resolveCanonicalInventoryCategory(unit.projectId, effectiveCategoryKey);
  if (inventoryCategoryId && !canonicalCategory) {
    throw new Error('Inventory category does not belong to this project');
  }
  const shouldWriteCanonicalCategory =
    inventoryCategoryId !== undefined || categoryKey !== undefined || (!unit.inventoryCategoryId && Boolean(unit.categoryKey));
  const effectiveInventoryCategoryId =
    inventoryCategoryId === null || categoryKey === null
      ? null
      : canonicalCategory?.id ?? (categoryKey === undefined && inventoryCategoryId === undefined ? unit.inventoryCategoryId : null);

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
      ...(inventoryCategoryId !== undefined && canonicalCategory && { categoryKey: canonicalCategory.categoryKey }),
      ...(shouldWriteCanonicalCategory && {
        inventoryCategoryId: effectiveInventoryCategoryId,
      }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(bathrooms !== undefined && { bathrooms }),
      ...(maxGuests !== undefined && { maxGuests }),
      ...(sizeSqm !== undefined && { sizeSqm }),
      ...(floor !== undefined && { floor }),
      ...(structureNodeId !== undefined && { structureNodeId }),
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

  if (status === 'live') await ensureLegacyStayOffering(unitId);

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
      structureNode: { include: { parent: true } },
      owner: true,
      engagements: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
