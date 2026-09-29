/**
 * Project-neutral seasonal tariff calculation.
 * The legacy source is only a provenance of rows; this function reads the
 * canonical CommercialOffering.pricingTerms.tariffGrid in integer satang.
 * Does not access LayantaraOS or any private snapshot at runtime.
 *
 * Calendar dates are UTC date-only and check-out is exclusive.
 * A missing/overlapping season fails closed rather than guessing a price.
 */
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
  if (nights < 1 || nights > 366) throw new Error('Invalid stay length');
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
    if (matches.length !== 1) throw new Error('Missing or overlapping tariff season on ' + date);
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
      throw new Error('Mixed tariff tax/service inclusion requires separate quote');
    if (row.sourceRateId !== precedingId) runLength = 0;
    const amount = mode === 'daily' ? row.amountSatang :
      Math.floor(row.amountSatang * (runLength + 1) / 30) -
      Math.floor(row.amountSatang * runLength / 30);
    lines.push({ date, nightlySatang: amount, sourceRateId: row.sourceRateId });
    subtotalSatang += amount;
    precedingId = row.sourceRateId;
    runLength += 1;
  }
  if (nights < firstMin) throw new Error('Stay length below seasonal minimum of ' + firstMin);
  if (!Number.isSafeInteger(subtotalSatang)) throw new Error('Tariff total overflow');
  return { mode, lines, subtotalSatang, includesTaxes: includesTaxes!,
    includesServiceCharge: includesServiceCharge!, includesBreakfast: includesBreakfast!,
    minNights: firstMin };
}
