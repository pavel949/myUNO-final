import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { quoteSeasonalTariffGrid } from './seasonal-tariff';
import { assertUnitPricingAccess, PricingAccessError } from './pricing-access';

type TariffDb = PrismaClient | Prisma.TransactionClient;
type SaveTariffInput = { unitIds: string[]; draft: TariffDraft; actorIdentityId: string; expectedRevision: string; categoryId?: string };

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
  /** Stable identity from this unit; used only to preserve an existing row. */
  sourceRateId?: string;
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
  const seenIds = new Set<string>();
  for (const s of seasons) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      errors.push({ code: 'season_code', kind });
      continue;
    }
    const issue = (code: string) => errors.push({ code, kind, season: s.seasonCode || '?' });
    if (typeof s.seasonCode !== 'string' || !SEASON.test(s.seasonCode)) issue('season_code');
    if (s.sourceRateId !== undefined) {
      if (typeof s.sourceRateId !== 'string' || !s.sourceRateId || seenIds.has(s.sourceRateId)) issue('season_duplicate');
      seenIds.add(s.sourceRateId);
    }
    if (seen.has(s.seasonCode)) issue('season_duplicate');
    seen.add(s.seasonCode);
    if (!Array.isArray(s.windows) || !s.windows.length) issue('window_missing');
    if (Array.isArray(s.windows) && s.windows.some(w => !w || typeof w.start !== 'string' || typeof w.end !== 'string' || !validMonthDay(w.start) || !validMonthDay(w.end))) issue('window_format');
    if (!Number.isSafeInteger(s.amountSatang) || s.amountSatang <= 0) issue('amount');
    if (!Number.isSafeInteger(s.minimumNights) || s.minimumNights < (kind === 'monthly' ? 30 : 1))
      issue(kind === 'monthly' ? 'minimum_monthly' : 'minimum');
    if (s.cancellationSteps) {
      const steps = s.cancellationSteps;
      const ok = Array.isArray(steps) && steps.length > 0 && steps.every((st, i) =>
        st && Number.isSafeInteger(st.days) && st.days >= 0 && Number.isFinite(st.pct) && st.pct >= 0 && st.pct <= 100 &&
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
  if (!draft || !Array.isArray(draft.daily) || !Array.isArray(draft.monthly))
    return { errors: [{ code: 'daily_missing', kind: 'daily' }], dailyGaps: [], monthlyGaps: [] };
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

function previousSeason(previous: Row[], mode: 'daily' | 'monthly', season: SeasonRate): Row | undefined {
  // Bulk application preserves each TARGET unit's own metadata. A source ID
  // from another unit cannot be copied into the target's provenance.
  return previous.find(row => row.rateMode === mode && season.sourceRateId && row.sourceRateId === season.sourceRateId)
    ?? previous.find(row => row.rateMode === mode && row.seasonCode === season.seasonCode);
}

function toRows(draft: TariffDraft, mode: 'daily' | 'monthly', previous: Row[]): Row[] {
  const seasons = mode === 'daily' ? draft.daily : draft.monthly;
  const rows = seasons.map(s => {
    const prior = previousSeason(previous, mode, s);
    return {
      ...(prior ?? {}),
      sourceRateId: typeof prior?.sourceRateId === 'string' ? prior.sourceRateId : `manual:${mode}:${s.seasonCode}`,
      seasonCode: s.seasonCode,
      dateWindows: s.windows.map((w, index) => ({
        ...asObject(Array.isArray(prior?.dateWindows) ? prior.dateWindows[index] : null),
        start: w.start, end: w.end,
      })),
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
  const ids = new Set<string>();
  for (const row of rows) {
    // Renaming A to B and adding a fresh A must not bind two rows to the same
    // saved source identity (or silently change monthly rounding/policies).
    if (ids.has(row.sourceRateId)) throw Object.assign(new Error('TARIFF_INVALID'), {
      issues: [{ code: 'row_identity', kind: mode, season: row.seasonCode }],
    });
    ids.add(row.sourceRateId);
  }
  return rows;
}

/** The editor's view of a unit's current grid. */
export async function readTariffDraft(db: TariffDb, unitId: string): Promise<TariffDraft & { sourceSystem: string | null }> {
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
      ...(typeof r.sourceRateId === 'string' ? { sourceRateId: r.sourceRateId } : {}),
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

/** Stable, quote-relevant baseline. JSON object key order is immaterial; row and array order is explicit. */
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ':' + stable(item)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export async function readTariffRevision(db: TariffDb, unitIds: string[]): Promise<string> {
  const ids = [...new Set(unitIds)].sort();
  const units = await db.unit.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' }, select: {
    id: true, projectId: true, inventoryCategoryId: true, status: true, updatedAt: true,
    baseNightlyThb: true, minNights: true, cancellationPolicyKey: true, maxGuests: true,
  } });
  if (!ids.length || units.length !== ids.length) throw new PricingAccessError('Inventory changed. Reload the tariff editor.', 409);
  const offers = await db.commercialOffering.findMany({ where: { unitId: { in: ids }, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
    orderBy: { id: 'asc' }, select: { id: true, unitId: true, offeringType: true, status: true, updatedAt: true, pricingTerms: true, rulesAndPolicies: true } });
  return createHash('sha256').update(stable({ units, offers })).digest('hex');
}

/** Draft, category target set and both baselines come from one PostgreSQL snapshot. */
export async function readTariffEditorSnapshot(db: PrismaClient, unitId: string, includeCategory: boolean) {
  return db.$transaction(async tx => {
    const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { id: true, inventoryCategoryId: true } });
    if (!unit) throw new PricingAccessError('Unit not found', 404);
    const unitIds = includeCategory && unit.inventoryCategoryId ? (await tx.unit.findMany({
      where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } }, select: { id: true }, orderBy: { id: 'asc' },
    })).map(row => row.id) : [unitId];
    return { draft: await readTariffDraft(tx, unitId), unitRevision: await readTariffRevision(tx, [unitId]),
      categoryRevision: includeCategory && unitIds.length > 1 ? await readTariffRevision(tx, unitIds) : null,
      categoryUnits: unitIds.length, ...(!includeCategory ? { permissions: await employeeTariffPermissions(tx, unitId) } : {}) };
  }, { isolationLevel: 'RepeatableRead' });
}

/** Shared lock order for admin/employee saves: category, sorted units, current authority, sorted offerings. */
async function lockTariffSave(tx: Prisma.TransactionClient, input: SaveTariffInput, adminOnly: boolean) {
  if (!/^[a-f0-9]{64}$/.test(input.expectedRevision ?? '')) throw new PricingAccessError('Reload the tariff editor before saving.', 409);
  const ids = [...new Set(input.unitIds)].sort();
  if (!ids.length || ids.length > 500 || ids.length !== input.unitIds.length)
    throw new PricingAccessError('Choose at most 500 distinct units', 400);
  if (input.categoryId) await tx.$queryRaw`SELECT id FROM inventory_category WHERE id = ${input.categoryId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM unit WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
  for (const id of ids) {
    const access = await assertUnitPricingAccess(tx, input.actorIdentityId, id, true);
    if (adminOnly && !access.isAdmin) throw new PricingAccessError('Administrator tariff authority required');
  }
  if (input.categoryId) {
    const actual = (await tx.unit.findMany({ where: { inventoryCategoryId: input.categoryId, status: { not: 'offboarded' } },
      select: { id: true }, orderBy: { id: 'asc' } })).map(row => row.id);
    if (JSON.stringify(actual) !== JSON.stringify(ids)) throw new PricingAccessError('Category membership changed. Reload the tariff editor.', 409);
  }
  // Existing approval/status writers also acquire these PostgreSQL row locks on UPDATE.
  // Missing offerings cannot be inserted through their unit FK while its FOR UPDATE lock is held.
  await tx.$queryRaw`SELECT id FROM commercial_offering WHERE unit_id = ANY(${ids}::text[])
    AND offering_type IN ('short_term_stay', 'long_term_rental') ORDER BY id FOR UPDATE`;
  if (await readTariffRevision(tx, ids) !== input.expectedRevision)
    throw new PricingAccessError('Tariffs or commercial settings changed. Reload and review before saving.', 409);
}

/**
 * Writes the draft to every given unit in one transaction and audits each.
 * Other pricing keys (source provenance, policy approvals) are preserved; the
 * engine fields are set so the grid quotes immediately. Booking policies of
 * the same mode/season keep their terms but take the edited minimum stay and
 * refund ladder, so the quote and the guest's terms never disagree.
 */
function validateForSave(input: SaveTariffInput) {
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

}

/** Single canonical writer shared by the admin and scoped employee entry points. */
async function writeTariffDraft(tx: Prisma.TransactionClient, input: SaveTariffInput, preserveApprovals = false, skipLong = false) {
  for (const unitId of input.unitIds) {
      const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { id: true } });
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      const offers = await tx.commercialOffering.findMany({
        where: { unitId, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
      });
      const write = async (type: 'short_term_stay' | 'long_term_rental', grid: Row[] | null) => {
        const existing = offers.find(o => o.offeringType === type);
        if (!grid) return;
        if (preserveApprovals && !existing) throw new PricingAccessError('Existing offering requires administrator setup', 409);
        const terms = asObject(existing?.pricingTerms);
        const previous = Array.isArray(terms.tariffGrid) ? terms.tariffGrid as Row[] : [];
        const mode = type === 'short_term_stay' ? 'daily' : 'monthly';
        const rules = asObject(existing?.rulesAndPolicies);
        const seasons = mode === 'daily' ? input.draft.daily : input.draft.monthly;
        const policies = Array.isArray(rules.bookingPolicies)
          ? (rules.bookingPolicies as Row[]).map(p => {
            const s = seasons.find(x => p.rate_mode === mode && p.season_code ===
              (previousSeason(previous, mode, x)?.seasonCode ?? x.seasonCode));
            if (!s) return p;
            const next: Row = { ...p, season_code: s.seasonCode, min_nights: s.minimumNights };
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
          ...(preserveApprovals ? {} : { quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true }),
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
      await write('short_term_stay', [
        ...toRows(input.draft, 'daily', Array.isArray(prevShort) ? prevShort as Row[] : []),
        ...(Array.isArray(prevShort) ? (prevShort as Row[]).filter(r => r.rateMode !== 'daily') : []),
      ]);
      const longRows = [
        ...(Array.isArray(prevLong) ? (prevLong as Row[]).filter(r => r.rateMode !== 'monthly' && r.rateMode !== 'yearly') : []),
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
      if (!skipLong) await write('long_term_rental', longRows.length || Array.isArray(prevLong) ? longRows : null);
    }
}

export async function saveTariffDraft(db: PrismaClient, input: SaveTariffInput): Promise<{ units: number; revision: string }> {
  validateForSave(input);
  return db.$transaction(async tx => {
    await lockTariffSave(tx, input, true);
    await writeTariffDraft(tx, input);
    return { units: input.unitIds.length, revision: await readTariffRevision(tx, input.unitIds) };
  }, { timeout: 30_000 });
}

/** Employee editing cannot publish supply, approve source/tax policy, or fan out to a category. */
export async function saveEmployeeTariffDraft(db: PrismaClient, input: {
  unitId: string; draft: TariffDraft; actorIdentityId: string; expectedRevision: string;
}): Promise<{ units: number; revision: string }> {
  const save = { unitIds: [input.unitId], draft: input.draft, actorIdentityId: input.actorIdentityId, expectedRevision: input.expectedRevision };
  validateForSave(save);
  return db.$transaction(async tx => {
    await lockTariffSave(tx, save, false);
    const permissions = await employeeTariffPermissions(tx, input.unitId);
    if (!permissions.canSave) throw new PricingAccessError(permissions.reason!, 409);
    const offers = await tx.commercialOffering.findMany({
      where: { unitId: input.unitId, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
      select: { offeringType: true, pricingTerms: true, rulesAndPolicies: true },
    });
    if (!permissions.canEditMonthly) {
      const current = await readTariffDraft(tx, input.unitId);
      if (JSON.stringify(input.draft.monthly) !== JSON.stringify(current.monthly) ||
          JSON.stringify(input.draft.yearly) !== JSON.stringify(current.yearly))
        throw new PricingAccessError('Monthly and yearly tariffs require administrator setup', 409);
    }
    for (const offer of offers) {
      const mode = offer.offeringType === 'short_term_stay' ? 'daily' : 'monthly';
      if (mode === 'monthly' && !permissions.canEditMonthly) continue;
      const terms = asObject(offer.pricingTerms);
      const rows = Array.isArray(terms.tariffGrid) ? terms.tariffGrid as Row[] : [];
      for (const row of rows.filter(r => ['daily', 'monthly', 'yearly'].includes(String(r.rateMode)))) {
        if ((['includesTaxes', 'includesServiceCharge', 'includesBreakfast'] as const).some(flag =>
          row[flag] !== input.draft[flag]))
          throw new PricingAccessError('Included taxes, charges and benefits require administrator approval', 409);
        if (row.sourceSellable !== true)
          throw new PricingAccessError('Unsellable source tariffs require administrator approval', 409);
      }
      const rules = asObject(offer.rulesAndPolicies);
      const policies = Array.isArray(rules.bookingPolicies) ? rules.bookingPolicies as Row[] : [];
      for (const season of input.draft[mode]) {
        const previous = previousSeason(rows, mode, season);
        const matching = policies.filter(p => p.active === true && p.rate_mode === mode &&
          p.season_code === (previous?.seasonCode ?? season.seasonCode));
        if ((terms.sourceSystem === 'layantara_os' || Boolean(season.cancellationSteps?.length)) && matching.length !== 1)
          throw new PricingAccessError('This season needs an approved booking policy before staff can save it', 409);
      }
    }
    await writeTariffDraft(tx, save, true, !permissions.canEditMonthly);
    return { units: 1, revision: await readTariffRevision(tx, [input.unitId]) };
  }, { timeout: 30_000 });
}

export async function employeeTariffPermissions(db: TariffDb, unitId: string) {
  const offers = await db.commercialOffering.findMany({
    where: { unitId, offeringType: { in: ['short_term_stay', 'long_term_rental'] } },
    select: { offeringType: true, pricingTerms: true },
  });
  const ready = (type: string) => {
    const offer = offers.find(o => o.offeringType === type);
    const terms = asObject(offer?.pricingTerms);
    return Boolean(offer && terms.quoteEngine === 'canonical_tariff_grid_v1' && terms.taxPolicyVerified === true &&
      Array.isArray(terms.tariffGrid) && (terms.sourceSystem !== 'layantara_os' || terms.policyEngineVerified === true));
  };
  const canSave = ready('short_term_stay');
  return { canSave, canEditMonthly: ready('long_term_rental'), canEditInclusions: false, canSaveCategory: false,
    reason: canSave ? null : 'An administrator must set up and approve this unit’s seasonal tariff first.' };
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

