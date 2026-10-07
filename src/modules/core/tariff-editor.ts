import type { Prisma, PrismaClient } from '@prisma/client';
import { quoteSeasonalTariffGrid } from './seasonal-tariff';

/**
 * The admin rates editor's write path for CommercialOffering tariff grids.
 *
 * Before this, seasons, monthly and yearly rates lived only in SQL scripts.
 * The editor reads and writes the SAME rows the pricing engine quotes from
 * (pricingTerms.tariffGrid on the short_term_stay / long_term_rental
 * offerings), so a saved rate is exactly what search, the unit page and
 * booking will charge. Validation fails closed: overlapping seasons, bad
 * windows or non-integer money never reach the grid.
 */

export interface SeasonRate {
  seasonCode: string;
  windows: Array<{ start: string; end: string }>;
  amountSatang: number;
  minimumNights: number;
  /** Refund ladder for this season: [{ days, pct }] from most to fewest days. */
  cancellationSteps?: Array<{ days: number; pct: number }> | null;
}

export interface TariffDraft {
  includesTaxes: boolean;
  includesServiceCharge: boolean;
  includesBreakfast: boolean;
  daily: SeasonRate[];
  monthly: SeasonRate[];
  yearly: { amountSatang: number; minimumNights: number } | null;
}

/** A validation problem as a code (content key suffix) plus where it is. */
export interface TariffIssue { code: string; kind: 'daily' | 'monthly' | 'yearly' | 'flags'; season?: string; day?: string }

export interface TariffValidation {
  errors: TariffIssue[];
  /** Calendar days (MM-DD) no daily season covers — not sellable on those nights. */
  dailyGaps: string[];
  monthlyGaps: string[];
}

const SEASON = /^[A-Z0-9_]{1,32}$/;
const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ALL_DAYS = DAYS_IN_MONTH.flatMap((n, m) =>
  Array.from({ length: n }, (_, d) => `${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`));

const validMonthDay = (s: string) => MONTH_DAY.test(s) && Number(s.slice(3)) <= DAYS_IN_MONTH[Number(s.slice(0, 2)) - 1];
const inWindow = (md: string, w: { start: string; end: string }) =>
  w.start <= w.end ? w.start <= md && md <= w.end : md >= w.start || md <= w.end;

function checkSeasons(kind: 'daily' | 'monthly', seasons: SeasonRate[], errors: TariffIssue[]): string[] {
  const seen = new Set<string>();
  for (const s of seasons) {
    const issue = (code: string) => errors.push({ code, kind, season: s.seasonCode || '?' });
    if (!SEASON.test(s.seasonCode)) issue('season_code');
    if (seen.has(s.seasonCode)) issue('season_duplicate');
    seen.add(s.seasonCode);
    if (!Array.isArray(s.windows) || !s.windows.length) issue('window_missing');
    if ((s.windows ?? []).some(w => !validMonthDay(w.start) || !validMonthDay(w.end))) issue('window_format');
    if (!Number.isSafeInteger(s.amountSatang) || s.amountSatang <= 0) issue('amount');
    if (!Number.isSafeInteger(s.minimumNights) || s.minimumNights < (kind === 'monthly' ? 30 : 1))
      issue(kind === 'monthly' ? 'minimum_monthly' : 'minimum');
    if (s.cancellationSteps) {
      const steps = s.cancellationSteps;
      const ok = steps.length > 0 && steps.every((st, i) =>
        Number.isSafeInteger(st.days) && st.days >= 0 && Number.isFinite(st.pct) && st.pct >= 0 && st.pct <= 100 &&
        (i === 0 || st.days < steps[i - 1].days));
      if (!ok) issue('cancellation_steps');
    }
  }
  if (errors.length) return [];
  const gaps: string[] = [];
  let overlaps = 0;
  for (const md of ALL_DAYS) {
    const hits = seasons.filter(s => s.windows.some(w => inWindow(md, w)));
    // One issue per overlapping day is noise; report the first few.
    if (hits.length > 1 && ++overlaps <= 3)
      errors.push({ code: 'overlap', kind, season: hits.map(h => h.seasonCode).join(' + '), day: md });
    if (!hits.length) gaps.push(md);
  }
  return gaps;
}

export function validateTariffDraft(draft: TariffDraft): TariffValidation {
  const errors: TariffIssue[] = [];
  if (!draft.daily.length) errors.push({ code: 'daily_missing', kind: 'daily' });
  const dailyGaps = checkSeasons('daily', draft.daily, errors);
  const monthlyGaps = draft.monthly.length ? checkSeasons('monthly', draft.monthly, errors) : [];
  if (draft.yearly) {
    if (!Number.isSafeInteger(draft.yearly.amountSatang) || draft.yearly.amountSatang <= 0) errors.push({ code: 'amount', kind: 'yearly' });
    if (!Number.isSafeInteger(draft.yearly.minimumNights) || draft.yearly.minimumNights < 365) errors.push({ code: 'minimum_yearly', kind: 'yearly' });
  }
  for (const flag of ['includesTaxes', 'includesServiceCharge', 'includesBreakfast'] as const)
    if (typeof draft[flag] !== 'boolean') errors.push({ code: 'flag', kind: 'flags', season: flag });
  return { errors, dailyGaps, monthlyGaps };
}

type Row = Record<string, unknown>;
const asObject = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};

function toRows(draft: TariffDraft, mode: 'daily' | 'monthly', previous: Row[]): Row[] {
  const seasons = mode === 'daily' ? draft.daily : draft.monthly;
  return seasons.map(s => {
    const prior = previous.find(r => r.rateMode === mode && r.seasonCode === s.seasonCode);
    return {
      ...(prior ?? {}),
      sourceRateId: typeof prior?.sourceRateId === 'string' ? prior.sourceRateId : `manual:${mode}:${s.seasonCode}`,
      seasonCode: s.seasonCode,
      dateWindows: s.windows.map(w => ({ start: w.start, end: w.end })),
      rateMode: mode,
      pricingUnit: mode === 'daily' ? 'night' : '30_nights',
      amountSatang: s.amountSatang,
      currency: 'THB',
      minimumNights: s.minimumNights,
      includesTaxes: draft.includesTaxes,
      includesServiceCharge: draft.includesServiceCharge,
      includesBreakfast: draft.includesBreakfast,
      sourceSellable: true,
    };
  });
}

/** The editor's view of a unit's current grid. */
export async function readTariffDraft(db: PrismaClient, unitId: string): Promise<TariffDraft & { sourceSystem: string | null }> {
  const offers = await db.commercialOffering.findMany({
    where: { unitId, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
    select: { offeringType: true, pricingTerms: true, rulesAndPolicies: true },
  });
  const short = offers.find(o => o.offeringType === 'short_term_stay');
  const long = offers.find(o => o.offeringType === 'long_term_rental');
  const rows = [short, long].flatMap(o => {
    const grid = asObject(o?.pricingTerms).tariffGrid;
    return Array.isArray(grid) ? grid as Row[] : [];
  });
  const policies = [short, long].flatMap(o => {
    const p = asObject(o?.rulesAndPolicies).bookingPolicies;
    return Array.isArray(p) ? p as Row[] : [];
  });
  const season = (mode: 'daily' | 'monthly') => rows.filter(r => r.rateMode === mode).map(r => {
    const policy = policies.find(p => p.rate_mode === mode && p.season_code === r.seasonCode && p.active === true);
    return {
      seasonCode: String(r.seasonCode),
      windows: Array.isArray(r.dateWindows) ? r.dateWindows as Array<{ start: string; end: string }> : [],
      amountSatang: Number(r.amountSatang),
      minimumNights: Number(r.minimumNights ?? (mode === 'monthly' ? 30 : 1)),
      cancellationSteps: Array.isArray(policy?.cancellation_steps) ? policy!.cancellation_steps as Array<{ days: number; pct: number }> : null,
    };
  });
  const year = rows.find(r => r.rateMode === 'yearly');
  const first = rows.find(r => r.rateMode === 'daily') ?? rows[0];
  const terms = asObject(short?.pricingTerms);
  return {
    sourceSystem: typeof terms.sourceSystem === 'string' ? terms.sourceSystem : null,
    includesTaxes: first?.includesTaxes === true,
    includesServiceCharge: first?.includesServiceCharge === true,
    includesBreakfast: first?.includesBreakfast === true,
    daily: season('daily'),
    monthly: season('monthly'),
    yearly: year ? { amountSatang: Number(year.amountSatang), minimumNights: Number(year.minimumNights ?? 365) } : null,
  };
}

/**
 * Writes the draft to every given unit in one transaction and audits each.
 * Other pricing keys (source provenance, policy approvals) are preserved; the
 * engine fields are set so the grid quotes immediately. Booking policies of
 * the same mode/season keep their terms but take the edited minimum stay and
 * refund ladder, so the quote and the guest's terms never disagree.
 */
export async function saveTariffDraft(
  db: PrismaClient,
  input: { unitIds: string[]; draft: TariffDraft; actorIdentityId: string },
): Promise<{ units: number }> {
  const check = validateTariffDraft(input.draft);
  if (check.errors.length) throw Object.assign(new Error('TARIFF_INVALID'), { issues: check.errors });
  // The engine's own reader must accept every season we are about to save:
  // quote one night inside each season's first window (minimum relaxed).
  for (const [mode, seasons] of [['daily', input.draft.daily], ['monthly', input.draft.monthly]] as const) {
    const rows = toRows(input.draft, mode, []).map(r => ({ ...r, minimumNights: 1 }));
    for (const season of seasons) {
      const start = '2028-' + season.windows[0].start; // leap year: 02-29 is a valid window start
      const next = new Date(Date.parse(start + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
      quoteSeasonalTariffGrid(rows, start, next, mode);
    }
  }

  await db.$transaction(async (tx) => {
    for (const unitId of input.unitIds) {
      const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { id: true } });
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      const offers = await tx.commercialOffering.findMany({
        where: { unitId, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
      });
      const write = async (type: 'short_term_stay' | 'long_term_rental', grid: Row[] | null) => {
        const existing = offers.find(o => o.offeringType === type);
        if (!grid) return;
        const terms = asObject(existing?.pricingTerms);
        const previous = Array.isArray(terms.tariffGrid) ? terms.tariffGrid as Row[] : [];
        const mode = type === 'short_term_stay' ? 'daily' : 'monthly';
        const rules = asObject(existing?.rulesAndPolicies);
        const seasons = mode === 'daily' ? input.draft.daily : input.draft.monthly;
        const policies = Array.isArray(rules.bookingPolicies)
          ? (rules.bookingPolicies as Row[]).map(p => {
            const s = seasons.find(x => p.rate_mode === mode && p.season_code === x.seasonCode);
            if (!s) return p;
            const next: Row = { ...p, min_nights: s.minimumNights };
            if (s.cancellationSteps === null) {
              // The editor's “Use standard policy” action explicitly removes
              // the season refund override; undefined preserves existing terms.
              delete next.cancellation_steps;
            } else if (s.cancellationSteps) {
              next.cancellation_steps = s.cancellationSteps;
            }
            return next;
          })
          : null;
        const nextTerms = {
          ...terms,
          quoteEngine: 'canonical_tariff_grid_v1',
          taxPolicyVerified: true,
          tariffGrid: grid,
          editedAt: new Date().toISOString(),
          editedByIdentityId: input.actorIdentityId,
        } as Prisma.InputJsonValue;
        const nextRules = (policies ? { ...rules, bookingPolicies: policies } : rules) as Prisma.InputJsonValue;
        if (existing) {
          await tx.commercialOffering.update({ where: { id: existing.id }, data: { pricingTerms: nextTerms, rulesAndPolicies: nextRules } });
        } else {
          // A new long-term offering starts as draft: monthly sale is a separate
          // commercial decision made in the offering step, not by saving rates.
          await tx.commercialOffering.create({ data: {
            unitId, offeringType: type, status: type === 'short_term_stay' ? 'active' : 'draft',
            pricingTerms: nextTerms,
          } });
        }
        await tx.auditLog.create({ data: {
          actorIdentityId: input.actorIdentityId, action: 'commercial_offering.tariff_saved',
          entityType: 'CommercialOffering', entityId: existing?.id ?? unitId,
          data: { unitId, offeringType: type, before: previous as Prisma.InputJsonValue, after: grid as Prisma.InputJsonValue },
        } });
      };
      const prevShort = asObject(offers.find(o => o.offeringType === 'short_term_stay')?.pricingTerms).tariffGrid;
      const prevLong = asObject(offers.find(o => o.offeringType === 'long_term_rental')?.pricingTerms).tariffGrid;
      await write('short_term_stay', toRows(input.draft, 'daily', Array.isArray(prevShort) ? prevShort as Row[] : []));
      const longRows = [
        ...toRows(input.draft, 'monthly', Array.isArray(prevLong) ? prevLong as Row[] : []),
        ...(input.draft.yearly ? [{
          ...((Array.isArray(prevLong) ? (prevLong as Row[]).find(r => r.rateMode === 'yearly') : null) ?? {}),
          sourceRateId: (Array.isArray(prevLong) ? (prevLong as Row[]).find(r => r.rateMode === 'yearly')?.sourceRateId : null) ?? 'manual:yearly',
          seasonCode: 'YEAR_CONTRACT', dateWindows: [], rateMode: 'yearly', pricingUnit: 'month',
          amountSatang: input.draft.yearly.amountSatang, currency: 'THB', minimumNights: input.draft.yearly.minimumNights,
          includesTaxes: input.draft.includesTaxes, includesServiceCharge: input.draft.includesServiceCharge,
          includesBreakfast: input.draft.includesBreakfast, sourceSellable: true,
        }] : []),
      ];
      await write('long_term_rental', longRows.length || Array.isArray(prevLong) ? longRows : null);
    }
  }, { timeout: 30_000 });
  return { units: input.unitIds.length };
}

/**
 * True when the villa is priced by a validated seasonal tariff grid. Dated
 * nightly overrides (PricingRule) are not read for such villas, so they must
 * be refused rather than silently ignored — rates live in the grid.
 */
export async function usesTariffGrid(db: Pick<PrismaClient, 'commercialOffering'>, unitId: string): Promise<boolean> {
  const offer = await db.commercialOffering.findFirst({
    where: { unitId, offeringType: 'short_term_stay', status: 'active' },
    select: { pricingTerms: true },
  });
  const terms = asObject(offer?.pricingTerms);
  return terms.quoteEngine === 'canonical_tariff_grid_v1' && terms.taxPolicyVerified === true && Array.isArray(terms.tariffGrid);
}
