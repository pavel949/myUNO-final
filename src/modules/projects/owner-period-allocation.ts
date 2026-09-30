/** Deterministic calendar-night allocation of a booking's snapshotted gross value.
 * Booking dates are half-open [check-in, check-out), and monetary values are
 * integer satang. Cumulative floor allocation preserves the exact total when
 * adjacent months are summed; it never counts the entire multi-month booking
 * independently in each month. This is a dashboard estimate of gross booked
 * revenue, not a substitute for paid receipts or the owner statement ledger.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function allocateBookingGrossToPeriod(
  totalSatang: number,
  checkIn: Date,
  checkOut: Date,
  periodStart: Date,
  periodEnd: Date,
): { nights: number; grossSatang: number } {
  const start = utcDay(checkIn);
  const end = utcDay(checkOut);
  const from = utcDay(periodStart);
  const to = utcDay(periodEnd);
  const totalNights = (end - start) / DAY_MS;
  if (!Number.isSafeInteger(totalSatang) || totalSatang < 0 ||
      ![start, end, from, to].every(Number.isFinite) ||
      totalNights <= 0 || to <= from) return { nights: 0, grossSatang: 0 };
  const boundedFrom = Math.max(start, Math.min(end, from));
  const boundedTo = Math.max(start, Math.min(end, to));
  const first = (boundedFrom - start) / DAY_MS;
  const last = (boundedTo - start) / DAY_MS;
  if (last <= first) return { nights: 0, grossSatang: 0 };
  // Cumulative floor means all adjacent periods reconcile to the original
  // integer satang total, even when it is not divisible by nights.
  const grossSatang = Math.floor(totalSatang * last / totalNights) -
    Math.floor(totalSatang * first / totalNights);
  return { nights: last - first, grossSatang };
}
