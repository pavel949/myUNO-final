import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { assertUnitPricingAccess, PricingAccessError } from '@/modules/core/pricing-access';
import { computeCanonicalCalendarRates } from '@/modules/core/canonical-pricing.service';
import {
  readTariffDraft,
  readTariffEditorSnapshotInTransaction,
} from '@/modules/core/tariff-editor';
import { datedPricingRevision, saveDatedPricing } from '@/modules/core/dated-pricing';
import {
  calendarDays,
  projectCalendar,
  shiftCalendarDay,
  validCalendarDay,
  type CalendarEntry,
} from '@/modules/booking/calendar-projection';

export const dynamic = 'force-dynamic';
async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new PricingAccessError('Unauthorized', 401);
  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true, status: true },
  });
  if (!identity?.isAdmin || identity.status !== 'active') throw new PricingAccessError();
  return user.identityId;
}
function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof PricingAccessError ? error.message : 'load_failed' },
    { status: error instanceof PricingAccessError ? error.status : 500 }
  );
}
export async function GET(req: NextRequest) {
  try {
    const identityId = await actor();
    const unitId = req.nextUrl.searchParams.get('unitId') ?? '';
    const start = req.nextUrl.searchParams.get('start') ?? '';
    const scope = req.nextUrl.searchParams.get('scope') ?? 'unit';
    if (!validCalendarDay(start) || !['unit', 'category'].includes(scope))
      throw new PricingAccessError('invalid_range', 400);
    return await prisma.$transaction(
      async (tx) => {
        const access = await assertUnitPricingAccess(tx, identityId, unitId);
        if (scope === 'category' && !access.unit.inventoryCategoryId)
          throw new PricingAccessError('category_missing', 400);
        const units = await tx.unit.findMany({
          where: {
            status: { not: 'offboarded' },
            ...(scope === 'category'
              ? { inventoryCategoryId: access.unit.inventoryCategoryId, projectId: access.unit.projectId }
              : { id: unitId }),
          },
          select: {
            id: true,
            name: true,
            projectId: true,
            inventoryCategoryId: true,
            inventoryCategory: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
          take: 101,
        });
        if (units.length > 100) throw new PricingAccessError('scope_too_large', 400);
        const ids = units.map((unit) => unit.id);
        const days = calendarDays(start, 14),
          end = shiftCalendarDay(start, 14);
        const dateWhere = {
          unitId: { in: ids },
          startDate: { lt: new Date(end) },
          endDate: { gt: new Date(start) },
        };
        const [bookings, blocks, revision, snapshot, rules] = await Promise.all([
          tx.booking.findMany({
            where: dateWhere,
            select: {
              id: true,
              unitId: true,
              startDate: true,
              endDate: true,
              status: true,
              holdExpiresAt: true,
            },
          }),
          tx.blockedDate.findMany({
            where: dateWhere,
            select: { id: true, unitId: true, startDate: true, endDate: true, reason: true },
          }),
          datedPricingRevision(tx, ids),
          readTariffEditorSnapshotInTransaction(tx, unitId, true),
          tx.pricingRule.findMany({
            where: { unitId: { in: ids } },
            orderBy: { startDate: 'asc' },
            select: {
              id: true,
              unitId: true,
              startDate: true,
              endDate: true,
              nightlyThb: true,
              minNightsOverride: true,
            },
          }),
        ]);
        const entries: CalendarEntry[] = [
          ...bookings.map((row) => ({
            ...row,
            kind: 'booking' as const,
            startDate: row.startDate.toISOString().slice(0, 10),
            endDate: row.endDate.toISOString().slice(0, 10),
            holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
          })),
          ...blocks.map((row) => ({
            ...row,
            kind: 'block' as const,
            status: 'active',
            startDate: row.startDate.toISOString().slice(0, 10),
            endDate: row.endDate.toISOString().slice(0, 10),
          })),
        ];
        const tariffs = Object.fromEntries(
          await Promise.all(
            units.map(async (unit) => [unit.id, await readTariffDraft(tx, unit.id)] as const)
          )
        );
        const rates: Record<string, Awaited<ReturnType<typeof computeCanonicalCalendarRates>>> = {};
        // Same bounded canonical calculation as /ops/calendar/board, never a UI formula.
        for (let offset = 0; offset < units.length; offset += 6) {
          await Promise.all(
            units.slice(offset, offset + 6).map(async (unit) => {
              rates[unit.id] = await computeCanonicalCalendarRates(
                tx,
                unit.id,
                new Date(start),
                new Date(end),
                1
              );
            })
          );
        }
        return NextResponse.json(
          {
            units,
            days,
            tariffs,
            rates,
            cells: projectCalendar(ids, days, entries, new Date()),
            revision,
            snapshot,
            rules: rules.map((rule) => ({
              ...rule,
              startDate: rule.startDate.toISOString().slice(0, 10),
              endDate: rule.endDate.toISOString().slice(0, 10),
            })),
          },
          { headers: { 'Cache-Control': 'private, no-store' } }
        );
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const actorIdentityId = await actor();
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) =>
          ![
            'unitId',
            'scope',
            'start',
            'end',
            'amountSatang',
            'minimumNights',
            'expectedRevision',
          ].includes(key)
      ) ||
      typeof body.unitId !== 'string' ||
      typeof body.start !== 'string' ||
      typeof body.end !== 'string' ||
      typeof body.expectedRevision !== 'string'
    )
      throw new PricingAccessError('invalid_range', 400);
    const result = await saveDatedPricing(prisma, { ...body, actorIdentityId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
