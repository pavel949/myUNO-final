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
  const now = new Date();
  const rows = await db.operatingSpaceUnit.findMany({
    where: {
      operatingSpaceId,
      active: true,
      operatingSpace: { status: 'active' },
      startsOn: { lte: now },
      OR: [
        { endsOn: null },
        { endsOn: { gt: now } },
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
