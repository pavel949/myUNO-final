import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import { UnitStatus, UnitType } from '@prisma/client';

interface CreateUnitInput {
  projectId: string;
  ownerIdentityId?: string;
  name: string;
  unitType: UnitType;
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
 * Create a new unit.
 * Admin/staff-only action.
 */
export async function createUnit(input: CreateUnitInput) {
  const {
    projectId,
    ownerIdentityId,
    name,
    unitType,
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

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Check name uniqueness within project
  const existing = await prisma.unit.findFirst({
    where: { projectId, name },
  });

  if (existing) {
    throw new Error(`Unit with name "${name}" already exists in this project`);
  }

  const unit = await prisma.unit.create({
    data: {
      projectId,
      ownerIdentityId: ownerIdentityId || null,
      name,
      unitType,
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

  // Audit log
  await logAudit({
    actorIdentityId,
    action: 'units:create',
    entityType: 'Unit',
    entityId: unit.id,
    data: {
      projectId,
      name,
      status,
    },
  });

  return unit;
}

/**
 * Get a unit by ID.
 */
export async function getUnit(unitId: string) {
  return await prisma.unit.findUnique({
    where: { id: unitId },
  });
}

/**
 * List units in a project.
 */
export async function listUnits(projectId: string, status?: UnitStatus) {
  return await prisma.unit.findMany({
    where: {
      projectId,
      ...(status && { status }),
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

  // Validate status transitions
  if (status && status !== unit.status) {
    if (status === 'live') {
      // Cannot go to live without permitted_use_confirmed_at
      if (!unit.permittedUseConfirmedAt) {
        throw new Error(
          'Unit cannot move to live status without permitted use confirmation'
        );
      }
    }
  }

  // Check name uniqueness if changing
  if (name && name !== unit.name) {
    const existing = await prisma.unit.findFirst({
      where: {
        projectId: unit.projectId,
        name,
        id: { not: unitId },
      },
    });

    if (existing) {
      throw new Error(
        `Unit with name "${name}" already exists in this project`
      );
    }
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: {
      ...(name !== undefined && { name }),
      ...(unitType !== undefined && { unitType }),
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

  // Audit log
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

/**
 * Confirm permitted use for a unit (allows moving to live status).
 */
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

  // Audit log
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

/**
 * Get unit detail with related data.
 */
export async function getUnitDetail(unitId: string) {
  return await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      project: true,
      owner: true,
      engagements: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
