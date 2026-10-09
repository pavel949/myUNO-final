import type { PrismaClient } from '@prisma/client';
import type { ReconciliationDecision } from './adapter';
import { blockingBookingConditions } from '@/modules/core/booking-occupancy';

/**
 * Stages a verified source occupancy using the same per-unit transaction lock
 * as canonical booking and manual availability writes. Operator-only primitive:
 * this module is intentionally not exposed by an API route. Dry-run by default.
 * A protective block is not a canonical booking or a financial transaction.
 */
export async function stageProtection(
  db: PrismaClient,
  input: { decision: ReconciliationDecision; mappingVerified: boolean; allowWrite?: boolean },
): Promise<{ status: 'planned' | 'existing' | 'created'; blockId: string | null }> {
  const { decision } = input;
  if (decision.action !== 'protect') throw new Error('Only active protective decisions may be staged');
  if (!input.mappingVerified) throw new Error('Physical unit crosswalk must be verified first');
  if (!input.allowWrite) return { status: 'planned', blockId: null };

  const startDate = new Date(decision.startDate + 'T00:00:00.000Z');
  const endDate = new Date(decision.endDate + 'T00:00:00.000Z');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${decision.unitId}))`;

    const unit = await tx.unit.findUnique({ where: { id: decision.unitId }, select: { id: true } });
    if (!unit) throw new Error('Target unit does not exist');
    const existing = await tx.blockedDate.findFirst({
      where: { unitId: decision.unitId, externalRef: decision.externalRef },
    });
    if (existing) {
      if (existing.startDate.getTime() !== startDate.getTime() ||
          existing.endDate.getTime() !== endDate.getTime() ||
          existing.reason !== decision.blockReason) {
        throw new Error('Source occupancy changed: reconcile the existing protection before replay');
      }
      return { status: 'existing' as const, blockId: existing.id };
    }
    const otherBlock = await tx.blockedDate.findFirst({
      where: { unitId: decision.unitId, startDate: { lt: endDate }, endDate: { gt: startDate } },
      select: { id: true },
    });
    if (otherBlock) throw new Error('Conflicting availability block: quarantine source row');
    const now = new Date();
    const booking = await tx.booking.findFirst({
      where: {
        unitId: decision.unitId, startDate: { lt: endDate }, endDate: { gt: startDate },
        OR: blockingBookingConditions(now),
      },
      select: { id: true },
    });
    if (booking) throw new Error('Conflicting canonical booking: quarantine source row');
    const block = await tx.blockedDate.create({
      data: {
        unitId: decision.unitId, startDate, endDate,
        reason: decision.blockReason, externalRef: decision.externalRef,
        note: 'Layantara protective occupancy; identity and financial reconciliation pending.',
      },
    });
    return { status: 'created' as const, blockId: block.id };
  });
}
