import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { validCalendarDay } from '@/modules/booking/calendar-projection';
import { assertUnitPricingAccess, PricingAccessError } from './pricing-access';
import { createPricingRule } from './availability.service';
import { readTariffRevision } from './tariff-editor';

type Db = PrismaClient | Prisma.TransactionClient;
export async function datedPricingRevision(db: Db, unitIds: string[]) {
  const ids = [...unitIds].sort();
  const rules = await db.pricingRule.findMany({
    where: { unitId: { in: ids } },
    orderBy: { id: 'asc' },
  });
  return createHash('sha256')
    .update(JSON.stringify([ids, await readTariffRevision(db, ids), rules]))
    .digest('hex');
}

/** Atomic category fan-out to the existing per-unit PricingRule writer model.
 * This is an explicit bulk edit, not a second category-price authority.
 * Overlaps fail closed; individual rules are never silently overwritten. */
export async function saveDatedPricing(
  db: PrismaClient,
  input: {
    actorIdentityId: string;
    unitId: string;
    scope: 'unit' | 'category';
    start: string;
    end: string;
    amountSatang: number;
    minimumNights?: number;
    expectedRevision: string;
  }
) {
  if (
    !['unit', 'category'].includes(input.scope) ||
    !validCalendarDay(input.start) ||
    !validCalendarDay(input.end) ||
    input.start >= input.end ||
    (Date.parse(input.end) - Date.parse(input.start)) / 86400000 > 366 ||
    !Number.isSafeInteger(input.amountSatang) ||
    input.amountSatang <= 0 ||
    input.amountSatang > 2147483647 ||
    (input.minimumNights !== undefined &&
      (!Number.isSafeInteger(input.minimumNights) ||
        input.minimumNights < 1 ||
        input.minimumNights > 366))
  )
    throw new PricingAccessError('invalid_range', 400);
  if (!/^[a-f0-9]{64}$/.test(input.expectedRevision)) throw new PricingAccessError('conflict', 409);
  return db.$transaction(
    async (tx) => {
      const initial = await assertUnitPricingAccess(tx, input.actorIdentityId, input.unitId);
      if (!initial.isAdmin) throw new PricingAccessError();
      const categoryId = input.scope === 'category' ? initial.unit.inventoryCategoryId : null;
      if (input.scope === 'category' && !categoryId)
        throw new PricingAccessError('category_missing', 409);
      if (categoryId)
        await tx.$queryRaw`SELECT id FROM inventory_category WHERE id = ${categoryId} FOR UPDATE`;
      const units =
        input.scope === 'category'
          ? await tx.unit.findMany({
              where: { inventoryCategoryId: categoryId, status: { not: 'offboarded' } },
              select: { id: true },
              orderBy: { id: 'asc' },
            })
          : [{ id: input.unitId }];
      if (!units.length || units.length > 100) throw new PricingAccessError('scope_too_large', 400);
      const ids = units.map((unit) => unit.id);
      await tx.$queryRaw`SELECT id FROM unit WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
      for (const id of ids) {
        const access = await assertUnitPricingAccess(tx, input.actorIdentityId, id, true);
        if (
          !access.isAdmin ||
          access.unit.status === 'offboarded' ||
          (categoryId && access.unit.inventoryCategoryId !== categoryId)
        )
          throw new PricingAccessError('conflict', 409);
      }
      await tx.$queryRaw`SELECT id FROM commercial_offering WHERE unit_id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
      if ((await datedPricingRevision(tx, ids)) !== input.expectedRevision)
        throw new PricingAccessError('conflict', 409);
      const startDate = new Date(input.start + 'T00:00:00Z'),
        endDate = new Date(input.end + 'T00:00:00Z');
      if (
        await tx.pricingRule.findFirst({
          where: { unitId: { in: ids }, startDate: { lt: endDate }, endDate: { gt: startDate } },
        })
      )
        throw new PricingAccessError('overlap', 409);
      for (const unitId of ids) {
        const rule = await createPricingRule(tx, {
          unitId,
          startDate,
          endDate,
          nightlyThb: input.amountSatang,
          appliesToTariffGrid: true,
          ...(input.minimumNights !== undefined ? { minNightsOverride: input.minimumNights } : {}),
        }).catch((error) => {
          if (error instanceof Error && /^(nightlyThb|minNightsOverride)/.test(error.message))
            throw new PricingAccessError('invalid_range', 400);
          throw error;
        });
        await tx.auditLog.create({
          data: {
            actorIdentityId: input.actorIdentityId,
            action: 'units:set_pricing_rule',
            entityType: 'PricingRule',
            entityId: rule.id,
            data: {
              unitId,
              categoryId,
              start: input.start,
              end: input.end,
              nightlyThb: input.amountSatang,
              minNightsOverride: input.minimumNights ?? null,
            },
          },
        });
      }
      return { saved: ids.length };
    },
    { timeout: 30000 }
  );
}
