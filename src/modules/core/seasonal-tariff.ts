/**
 * Project-neutral seasonal tariff calculation.
 * The legacy source is only a provenance of rows; this function reads the
 * canonical CommercialOffering.pricingTerms.tariffGrid in integer satang.
 * Does not access LayantaraOS or any private snapshot at runtime.
 *
 * Calendar dates are UTC date-only and check-out is exclusive.
 * A missing/overlapping season fails closed rather than guessing a price.
 */
import { StayUnquotableError } from './stay-unquotable';

export type TariffRow = {
  sourceRateId: string;
  seasonCode: string;
  dateWindows: Array<{ start: string; end: string }>;
  rateMode: 'daily' | 'monthly';
  pricingUnit: 'night' | '30_nights';
  amountSatang: number;
  currency: 'THB';
  minimumNights: number | null;
  includesTaxes: boolean;
  includesServiceCharge: boolean;
  includesBreakfast: boolean;
  sourceSellable: boolean;
};
export type TariffMode = 'daily' | 'monthly';
export type TariffQuote = {
  mode: TariffMode;
  lines: Array<{ date: string; nightlySatang: number; sourceRateId: string }>;
  subtotalSatang: number;
  includesTaxes: boolean;
  includesServiceCharge: boolean;
  includesBreakfast: boolean;
  minNights: number;
};

const DAY = 86_400_000;
function day(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Invalid calendar date');
  const d = new Date(s + 'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    throw new Error('Invalid calendar date');
  return d.getTime();
}
function matchWindow(iso: string, w: { start: string; end: string }): boolean {
  if (!/^\d{2}-\d{2}$/.test(w.start) || !/^\d{2}-\d{2}$/.test(w.end))
    throw new Error('Invalid season window');
  const monthDay = iso.slice(5);
  return w.start <= w.end
    ? w.start <= monthDay && monthDay <= w.end
    : monthDay >= w.start || monthDay <= w.end;
}
function tariffRows(input: unknown, mode: TariffMode): TariffRow[] {
  if (!Array.isArray(input)) throw new Error('Canonical tariff grid required');
  const rows = input.filter((row): row is TariffRow =>
    typeof row === 'object' && row !== null && row.rateMode === mode);
  if (!rows.length) throw new Error('Published tariff mode is missing');
  for (const r of rows) {
    if (!r.sourceRateId || !r.seasonCode || !Array.isArray(r.dateWindows) ||
      !r.dateWindows.length || !Number.isSafeInteger(r.amountSatang) ||
      r.amountSatang <= 0 || r.currency !== 'THB' ||
      (mode === 'daily' ? r.pricingUnit !== 'night' : r.pricingUnit !== '30_nights') ||
      r.sourceSellable !== true ||
      !['includesTaxes', 'includesServiceCharge', 'includesBreakfast']
        .every(k => typeof (r as unknown as Record<string, unknown>)[k] === 'boolean') ||
      (r.minimumNights !== null &&
        (!Number.isInteger(r.minimumNights) || r.minimumNights < 1))
    ) throw new Error('Invalid or unsellable tariff row');
  }
  return rows;
}
export function quoteSeasonalTariffGrid(
  rawRows: unknown, start: string, end: string, mode: TariffMode,
): TariffQuote {
  const from = day(start), to = day(end);
  const nights = (to - from) / DAY;
  if (nights < 1) throw new Error('Invalid stay length');
  // Longer than one published year is a lease conversation, not a fault.
  if (nights > 366) throw new StayUnquotableError('Stay length exceeds the bookable maximum of 366 nights');
  const rows = tariffRows(rawRows, mode);
  const lines: TariffQuote['lines'] = [];
  let firstMin = 1;
  let includesTaxes: boolean | undefined;
  let includesServiceCharge: boolean | undefined;
  let includesBreakfast: boolean | undefined;
  let runLength = 0;
  let precedingId = '';
  let subtotalSatang = 0;
  for (let t = from; t < to; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const matches = rows.filter(r => r.dateWindows.some(w => matchWindow(date, w)));
    // No published season covering a night: not sellable for these dates.
    if (matches.length === 0) throw new StayUnquotableError('Missing or overlapping tariff season on ' + date);
    // Two seasons on one night is a broken grid, not an availability answer.
    if (matches.length > 1) throw new Error('Missing or overlapping tariff season on ' + date);
    const row = matches[0];
    if (t === from) firstMin = row.minimumNights ?? (mode === 'monthly' ? 30 : 1);
    if (includesTaxes === undefined) {
      includesTaxes = row.includesTaxes;
      includesServiceCharge = row.includesServiceCharge;
      includesBreakfast = row.includesBreakfast;
    }
    if (row.includesTaxes !== includesTaxes ||
      row.includesServiceCharge !== includesServiceCharge ||
      row.includesBreakfast !== includesBreakfast)
      throw new StayUnquotableError('Mixed tariff tax/service inclusion requires separate quote');
    if (row.sourceRateId !== precedingId) runLength = 0;
    const amount = mode === 'daily' ? row.amountSatang :
      Math.floor(row.amountSatang * (runLength + 1) / 30) -
      Math.floor(row.amountSatang * runLength / 30);
    lines.push({ date, nightlySatang: amount, sourceRateId: row.sourceRateId });
    subtotalSatang += amount;
    precedingId = row.sourceRateId;
    runLength += 1;
  }
  if (nights < firstMin) throw new StayUnquotableError('Stay length below seasonal minimum of ' + firstMin);
  if (!Number.isSafeInteger(subtotalSatang)) throw new Error('Tariff total overflow');
  return { mode, lines, subtotalSatang, includesTaxes: includesTaxes!,
    includesServiceCharge: includesServiceCharge!, includesBreakfast: includesBreakfast!,
    minNights: firstMin };
}

/**
 * Nights from which the published 12-month lease rate applies, or null when
 * the grid carries no sellable annual row. Stays this long are routed to a
 * lease request (LeaseRequestRequiredError), never quoted from monthly rows.
 */
export function annualLeaseMinimumNights(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const minimums = raw
    .filter(r => r && typeof r === 'object' && r.rateMode === 'yearly' && r.sourceSellable === true)
    .map(r => (r as Record<string, unknown>).minimumNights)
    .filter((n): n is number => Number.isSafeInteger(n) && (n as number) >= 365);
  return minimums.length ? Math.min(...minimums) : null;
}

/** Contract-only yearly rental preview. Never pass through the nightly
 * Booking Engine: legal lease duration, deposit and instalments require a
 * separate accepted contract. The monthly published figure is retained.
 */
export function previewAnnualLeaseTariff(raw: unknown) {
  if (!Array.isArray(raw)) throw new Error('Annual lease tariff missing');
  const rows = raw.filter(r => r && r.rateMode === 'yearly');
  if (rows.length !== 1) throw new Error('Annual lease tariff missing or ambiguous');
  const row = rows[0] as Record<string, unknown>;
  const amount = row.amountSatang;
  const minimum = row.minimumNights;
  if (row.currency !== 'THB' || row.pricingUnit !== 'month' ||
      row.sourceSellable !== true || !Number.isSafeInteger(amount) ||
      (amount as number) <= 0 || !Number.isSafeInteger(minimum) ||
      (minimum as number) < 365)
    throw new Error('Invalid annual lease tariff');
  const total = (amount as number) * 12;
  if (!Number.isSafeInteger(total)) throw new Error('Annual lease total overflow');
  return {
    sourceRateId: row.sourceRateId,
    currency: 'THB',
    monthlySatang: amount as number,
    illustrativeTwelveMonthSatang: total,
    minimumNights: minimum as number,
    bookingEngineEligible: false,
    requiresSignedLease: true,
  };
}
