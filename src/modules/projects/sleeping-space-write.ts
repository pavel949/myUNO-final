import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { validateSleepingSpace, type ValidatedSleepingSpace } from './sleeping-space-input';

export class SleepingSpaceRequestConflict extends Error {}
export function sleepingSpaceRequestKey(unitId: string, requestId: string): string {
  return 'sleeping-request-' + createHash('sha256').update(JSON.stringify([unitId, requestId])).digest('hex');
}
function sameLayout(existing: { unitId: string; spaceType: string; name: string | null; sortOrder: number; beds: Array<{ bedType: string; count: number }> }, unitId: string, input: ValidatedSleepingSpace) {
  return existing.unitId === unitId && existing.spaceType === input.spaceType && existing.name === input.name &&
    existing.sortOrder === input.sortOrder && JSON.stringify(existing.beds.map(({ bedType, count }) => ({ bedType, count })).sort((a, b) => a.bedType.localeCompare(b.bedType))) === JSON.stringify(input.beds);
}
/** Reuses the existing canonical tables. No capacity, readiness or verification writes. */
export async function saveSleepingSpace(db: Pick<PrismaClient, 'sleepingSpace'>, unitId: string, body: unknown) {
  const input = validateSleepingSpace(body);
  const id = input.requestId ? sleepingSpaceRequestKey(unitId, input.requestId) : undefined;
  try {
    // Nested create is atomic. The existing primary key arbitrates concurrent replays.
    const space = await db.sleepingSpace.create({
      data: { ...(id ? { id } : {}), unitId, spaceType: input.spaceType, name: input.name,
        sortOrder: input.sortOrder, beds: { create: input.beds } },
      include: { beds: true },
    });
    return { space, created: true };
  } catch (error) {
    if (!id || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
    // Not find-then-create: the loser reads the committed winner after unique violation.
    const existing = await db.sleepingSpace.findUnique({ where: { id }, include: { beds: true } });
    if (!existing) throw error;
    if (!sameLayout(existing, unitId, input)) {
      throw new SleepingSpaceRequestConflict('This request ID already saved a different sleeping space');
    }
    return { space: existing, created: false };
  }
}
