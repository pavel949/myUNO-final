import type { Prisma, PrismaClient } from '@prisma/client';
import { assertPropertyCapabilityForUnit, listPropertyCapabilityUnits } from './property-capability-access';
export { PropertyCapabilityError as PricingAccessError } from './property-capability-access';

type Db = PrismaClient | Prisma.TransactionClient;
export async function assertUnitPricingAccess(db: Db, actorIdentityId: string, unitId: string, lock = false) {
  const { actor, unit } = await assertPropertyCapabilityForUnit(db, actorIdentityId, 'pricing_editor', unitId, lock);
  return { actorIdentityId: actor.id, isAdmin: actor.isAdmin, unit };
}
/** Minimal picker and current parent checks are shared with booking-mode capability. */
export async function listPricingUnits(db: Db, actorIdentityId: string) {
  return listPropertyCapabilityUnits(db, actorIdentityId, 'pricing_editor');
}
