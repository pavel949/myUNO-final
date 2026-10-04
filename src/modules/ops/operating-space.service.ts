import type { PrismaClient } from '@prisma/client';

export const OPERATING_SPACE_CAPABILITIES = [
  'view_calendar',
  'manage_reservations',
  'manage_tasks',
  'assign_tasks',
  'manage_housekeeping',
  'manage_maintenance',
  'manage_pricing',
  'manage_availability',
  'view_finance',
  'record_expense',
  'generate_owner_report',
  'manage_team',
  'manage_channels',
] as const;

export type OperatingSpaceCapability = typeof OPERATING_SPACE_CAPABILITIES[number];

export async function listOperatingSpacesForIdentity(
  db: PrismaClient,
  identityId: string,
) {
  return db.operatingSpace.findMany({
    where: {
      status: 'active',
      members: {
        some: {
          identityId,
          active: true,
        },
      },
    },
    select: {
      id: true,
      key: true,
      name: true,
      timezone: true,
      organizationId: true,
      _count: {
        select: {
          units: {
            where: { active: true },
          },
          members: {
            where: { active: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getOperatingSpaceUnitIds(
  db: PrismaClient,
  operatingSpaceId: string,
) {
  const rows = await db.operatingSpaceUnit.findMany({
    where: {
      operatingSpaceId,
      active: true,
      OR: [
        { endsOn: null },
        { endsOn: { gt: new Date() } },
      ],
    },
    select: { unitId: true },
  });
  return rows.map((row) => row.unitId);
}

export async function getOperatingSpaceMembership(
  db: PrismaClient,
  operatingSpaceId: string,
  identityId: string,
) {
  return db.operatingSpaceMember.findUnique({
    where: {
      operatingSpaceId_identityId: {
        operatingSpaceId,
        identityId,
      },
    },
    select: {
      id: true,
      active: true,
      capabilities: true,
      operatingSpace: {
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          organizationId: true,
          timezone: true,
        },
      },
    },
  });
}

export async function hasOperatingSpaceCapability(
  db: PrismaClient,
  operatingSpaceId: string,
  identityId: string,
  capability: OperatingSpaceCapability,
) {
  const membership = await getOperatingSpaceMembership(
    db,
    operatingSpaceId,
    identityId,
  );
  if (!membership?.active || membership.operatingSpace.status !== 'active') return false;
  return membership.capabilities.includes(capability);
}

export async function hasOperatingSpaceMembershipForUnit(
  db: PrismaClient,
  unitId: string,
  identityId: string,
) {
  const membership = await db.operatingSpaceMember.findFirst({
    where: {
      identityId,
      active: true,
      operatingSpace: {
        status: 'active',
        units: {
          some: {
            unitId,
            active: true,
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function hasOperatingSpaceCapabilityForUnit(
  db: PrismaClient,
  unitId: string,
  identityId: string,
  capability: OperatingSpaceCapability,
) {
  const memberships = await db.operatingSpaceMember.findMany({
    where: {
      identityId,
      active: true,
      capabilities: { has: capability },
      operatingSpace: {
        status: 'active',
        units: {
          some: {
            unitId,
            active: true,
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
        },
      },
    },
    select: { id: true },
    take: 1,
  });
  return memberships.length > 0;
}

export async function hasAnyOperatingSpaceCapability(
  db: PrismaClient,
  operatingSpaceId: string,
  identityId: string,
  capabilities: readonly OperatingSpaceCapability[],
) {
  for (const capability of capabilities) {
    if (await hasOperatingSpaceCapability(db, operatingSpaceId, identityId, capability)) return true;
  }
  return false;
}

export async function assertOperatingSpaceCapability(
  db: PrismaClient,
  operatingSpaceId: string,
  identityId: string,
  capability: OperatingSpaceCapability,
) {
  const allowed = await hasOperatingSpaceCapability(
    db,
    operatingSpaceId,
    identityId,
    capability,
  );
  if (!allowed) {
    throw new Error('OPERATING_SPACE_FORBIDDEN');
  }
}
