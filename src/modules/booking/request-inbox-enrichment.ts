import { PrismaClient } from '@prisma/client';
import type { PriceBreakdown } from '@/modules/core';

export interface BookingRequestBreakdownLine {
  labelKey: string;
  amountThb: number;
}

export interface BookingRequestInboxItem {
  id: string;
  startDate: Date;
  endDate: Date;
  totalThb: number;
  adults: number;
  children: number;
  requestExpiresAt: Date | null;
  guestIdentityId: string;
  guestIdentity: {
    id: string;
    firstName: string;
    lastName: string;
  };
  unit: { id: string; name: string };
  projectName?: string;
  nights: number;
  completedStayCount: number;
  breakdownLines: BookingRequestBreakdownLine[];
}

interface RawBookingRequestRow {
  id: string;
  startDate: Date;
  endDate: Date;
  totalThb: number;
  adults: number;
  children: number;
  requestExpiresAt: Date | null;
  priceBreakdown?: unknown;
  guestIdentity: {
    id: string;
    firstName: string;
    lastName: string;
  };
  unit: { id: string; name: string };
  project?: { name: string };
}

function nightsBetween(startDate: Date, endDate: Date): number {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function toBaht(satang: number): number {
  return Math.round(satang / 100);
}

/**
 * Turn stored price breakdown JSON into display lines (doc 07 F-OPS-5).
 * Amounts are returned in baht for UI; source values are satang.
 */
export function summarizePriceBreakdown(
  breakdown: unknown,
  totalThbSatang: number
): BookingRequestBreakdownLine[] {
  const parsed = breakdown as Partial<PriceBreakdown> | null | undefined;
  const lines: BookingRequestBreakdownLine[] = [];

  if (parsed?.subtotal_thb != null) {
    lines.push({
      labelKey: 'booking.request_breakdown.subtotal',
      amountThb: toBaht(parsed.subtotal_thb),
    });
  }
  if (parsed?.los_discount_thb && parsed.los_discount_thb > 0) {
    lines.push({
      labelKey: 'booking.request_breakdown.los_discount',
      amountThb: -toBaht(parsed.los_discount_thb),
    });
  }
  if (parsed?.early_bird_discount_thb && parsed.early_bird_discount_thb > 0) {
    lines.push({
      labelKey: 'booking.request_breakdown.early_bird_discount',
      amountThb: -toBaht(parsed.early_bird_discount_thb),
    });
  }
  if (parsed?.cleaning_fee_thb && parsed.cleaning_fee_thb > 0) {
    lines.push({
      labelKey: 'booking.request_breakdown.cleaning_fee',
      amountThb: toBaht(parsed.cleaning_fee_thb),
    });
  }
  if (parsed?.service_fee_thb && parsed.service_fee_thb > 0) {
    lines.push({
      labelKey: 'booking.request_breakdown.service_fee',
      amountThb: toBaht(parsed.service_fee_thb),
    });
  }
  if (parsed?.occupancy_tax_thb && parsed.occupancy_tax_thb > 0) {
    lines.push({
      labelKey: 'booking.request_breakdown.occupancy_tax',
      amountThb: toBaht(parsed.occupancy_tax_thb),
    });
  }

  lines.push({
    labelKey: 'booking.request_breakdown.total',
    amountThb: toBaht(totalThbSatang),
  });

  return lines;
}

async function loadCompletedStayCounts(
  db: PrismaClient,
  guestIdentityIds: string[]
): Promise<Map<string, number>> {
  if (guestIdentityIds.length === 0) {
    return new Map();
  }

  const counts = await db.booking.groupBy({
    by: ['guestIdentityId'],
    where: {
      guestIdentityId: { in: guestIdentityIds },
      status: 'completed',
    },
    _count: { _all: true },
  });

  return new Map(counts.map((row) => [row.guestIdentityId, row._count._all]));
}

/**
 * Attach guest history and price breakdown to pending request rows.
 */
export async function enrichBookingRequestInbox(
  db: PrismaClient,
  rows: RawBookingRequestRow[]
): Promise<BookingRequestInboxItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const guestIdentityIds = Array.from(new Set(rows.map((row) => row.guestIdentity.id)));
  const stayCounts = await loadCompletedStayCounts(db, guestIdentityIds);

  return rows.map((row) => ({
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    totalThb: row.totalThb,
    adults: row.adults,
    children: row.children,
    requestExpiresAt: row.requestExpiresAt,
    guestIdentityId: row.guestIdentity.id,
    guestIdentity: row.guestIdentity,
    unit: row.unit,
    projectName: row.project?.name,
    nights: nightsBetween(row.startDate, row.endDate),
    completedStayCount: stayCounts.get(row.guestIdentity.id) ?? 0,
    breakdownLines: summarizePriceBreakdown(row.priceBreakdown, row.totalThb),
  }));
}
