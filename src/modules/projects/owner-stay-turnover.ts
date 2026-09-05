import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createServiceOrder } from '@/modules/services';
import { recordCost } from '@/modules/finance';

/**
 * When `owner_stay.charge_cleaning` is true (doc 04, F-OWN-6), schedule a
 * post-checkout turnover clean: prefer a project cleaning service order linked
 * to the owner-stay booking; fall back to a ledger cleaning_cost line using
 * `pricing.cleaning_fee_thb` when no service is catalogued.
 *
 * Best-effort — never throws into the booking path.
 */
export async function scheduleOwnerStayTurnoverClean(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { id: true, name: true, projectId: true } },
      },
    });

    if (!booking || booking.bookingType !== 'owner_stay' || !booking.unit) {
      return;
    }

    const chargeCleaning = await getConfig(db, 'owner_stay.charge_cleaning', {
      projectId: booking.projectId,
      unitId: booking.unitId,
    });

    if (!chargeCleaning) {
      return;
    }

    const scope = { projectId: booking.projectId, unitId: booking.unitId };
    const candidates = await db.service.findMany({
      where: {
        categoryKey: 'cleaning',
        status: 'active',
        provider: { status: 'active', vetted_at: { not: null } },
      },
      include: { availableProjects: { select: { project_id: true } } },
      orderBy: { basePriceThb: 'asc' },
    });

    const service = candidates.find(
      (row) =>
        row.availableProjects.length === 0 ||
        row.availableProjects.some((link) => link.project_id === booking.projectId)
    );

    if (service?.basePriceThb) {
      const scheduledStart = new Date(booking.endDate);
      scheduledStart.setHours(10, 0, 0, 0);
      const durationMs = (service.durationMin || 120) * 60 * 1000;
      const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);
      const takeRatePct =
        ((await getConfig(db, 'services.take_rate_pct', scope)) as number) ?? 15;

      await createServiceOrder(db, {
        serviceId: service.id,
        projectId: booking.projectId,
        unitId: booking.unitId,
        bookingId: booking.id,
        ordererIdentityId: booking.guestIdentityId,
        ordererRole: 'owner',
        scheduledStart,
        scheduledEnd,
        quantity: 1,
        priceBreakdown: {
          base_thb: service.basePriceThb,
          quantity: 1,
          total_thb: service.basePriceThb,
          source: 'owner_stay_turnover',
        },
        totalThb: service.basePriceThb,
        tookRatePctSnapshot: takeRatePct,
        noteToProvider: `Post-owner-stay turnover clean for ${booking.unit.name}`,
      });
      return;
    }

    const cleaningFeeThb =
      ((await getConfig(db, 'pricing.cleaning_fee_thb', scope)) as number) ?? 0;

    if (cleaningFeeThb > 0) {
      await recordCost(db, {
        unitId: booking.unitId,
        entryType: 'cleaning_cost',
        amountThb: cleaningFeeThb,
        occurredOn: booking.endDate,
        description: `Post-owner-stay turnover clean (booking ${booking.id})`,
        recordedByIdentityId: booking.guestIdentityId,
      });
    }
  } catch (error) {
    console.error('[ownerStayTurnover] scheduling failed (non-blocking):', error);
  }
}
