import { prisma } from '@/lib/prisma';

/** Owners may configure their verified self-operated supply, never a myUNO-managed or externally controlled unit. */
export async function hasSelfListingAccess(identityId: string, unitId: string): Promise<boolean> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { ownerIdentityId: true, status: true } });
  if (!unit || unit.ownerIdentityId !== identityId || unit.status === 'offboarded') return false;
  const role = await prisma.roleAssignment.findFirst({ where: {
    identityId, role: 'owner', status: 'active', scopeType: 'unit', unitId,
  }, select: { id: true } });
  if (!role) return false;
  const now = new Date();
  const engagements = await prisma.unitEngagement.findMany({ where: { unitId, status: 'active' },
    select: { engagementType: true, ownerIdentityId: true, startsOn: true, endsOn: true } });
  if (engagements.length !== 1) return false;
  const engagement = engagements[0];
  if (engagement.engagementType !== 'owner_direct' || engagement.ownerIdentityId !== identityId ||
    (engagement.startsOn && engagement.startsOn > now) || (engagement.endsOn && engagement.endsOn <= now)) return false;
  // Source-owned inventory requires a separate verified authority cutover.
  const external = await prisma.externalMapping.findFirst({ where: { entity_type: 'unit', internal_id: unitId }, select: { id: true } });
  return !external;
}
