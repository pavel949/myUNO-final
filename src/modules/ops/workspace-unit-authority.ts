import type { Prisma, PrismaClient } from '@prisma/client';
import { eligibleOrganizationUnits, isolatedWorkspaceAdministratorUnitIds } from './operating-space-access.service';

/** Explicit physical-unit boundary. Never grants a project-wide or global role. */
export async function hasWorkspaceAdministratorUnitAccess(db: PrismaClient | Prisma.TransactionClient,
  identityId: string, resource: { projectId: string; unitId: string }) {
  const actor = await db.identity.findUnique({ where: { id: identityId }, select: { status: true } });
  if (actor?.status !== 'active') return false;
  const unit = await db.unit.findUnique({ where: { id: resource.unitId }, select: { projectId: true, status: true } });
  if (!unit || unit.projectId !== resource.projectId || unit.status === 'offboarded') return false;
  const now = new Date();
  const memberships = await db.operatingSpaceMember.findMany({ where: {
    identityId, active: true, isAdministrator: true,
    operatingSpace: { status: 'active', organization: { status: 'active' }, units: { some: {
      unitId: resource.unitId, active: true, startsOn: { lte: now }, OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    } } },
  }, select: { operatingSpaceId: true, operatingSpace: { select: { organizationId: true } } } });
  for (const member of memberships) {
    if ((await eligibleOrganizationUnits(db, member.operatingSpace.organizationId, now)).some(u => u.id === resource.unitId) &&
      (await isolatedWorkspaceAdministratorUnitIds(db, member.operatingSpaceId, [resource.unitId], now)).includes(resource.unitId)) return true;
  }
  return false;
}
