import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import {
  hasOperatingSpaceCapabilityForUnit,
  hasOperatingSpaceMembershipForUnit,
  type OperatingSpaceCapability,
} from '@/modules/ops';

/**
 * OperatingSpace capabilities are an additional restriction on exact-unit
 * operational roles created through a managed workspace. Legacy/project/MC
 * authority remains canonical when the identity is not assigned to an
 * OperatingSpace containing this unit.
 */
export async function passesOperatingSpaceUnitCapability(
  user: CurrentUser,
  unitId: string,
  capability: OperatingSpaceCapability,
) {
  if (user.isAdmin) return true;
  const governed = await hasOperatingSpaceMembershipForUnit(
    prisma,
    unitId,
    user.identityId,
  );
  if (!governed) return true;
  return hasOperatingSpaceCapabilityForUnit(
    prisma,
    unitId,
    user.identityId,
    capability,
  );
}
