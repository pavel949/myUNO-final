/**
 * Cancellation policy and refund calculation.
 * Policies are snapshots taken at booking time.
 */
import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { computePriceBreakdown } from '@/modules/core';

export interface PolicyStep {
  days_before_checkin: number;
  refund_pct: number;
}

export interface CancellationPolicy {
  name: string;
  steps: PolicyStep[];
}

/**
 * Compute refund percentage based on cancellation policy and cancellation time.
 * The policy is an ordered list of steps: the first step whose threshold is met applies.
 *
 * Example flexible policy: [{days: 1, pct: 100}, {days: 0, pct: 0}]
 * - Cancel 2+ days before check-in: 100% refund
 * - Cancel < 1 day before check-in: 0% refund
 *
 * @param policy - Cancellation policy steps
 * @param checkInDate - Check-in date
 * @param cancellationTime - When the cancellation is happening (default now)
 * @returns Refund percentage (0-100)
 */
export function computeRefundPercentage(
  policy: PolicyStep[],
  checkInDate: Date,
  cancellationTime: Date = new Date()
): number {
  // Full days from cancellation to check-in. Floor, not ceil: 21 hours before
  // check-in is 0 full days — ceil would round it up to 1 and grant a 100%
  // refund inside the no-refund window.
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilCheckIn = Math.floor(
    (checkInDate.getTime() - cancellationTime.getTime()) / msPerDay
  );

  // Find the first step that matches
  for (const step of policy) {
    if (daysUntilCheckIn >= step.days_before_checkin) {
      return step.refund_pct;
    }
  }

  // Fallback: return 0% if no step matches (shouldn't happen with well-formed policies)
  return 0;
}

/**
 * Compute refund amount based on policy and booking details.
 *
 * @param totalPaid - Total amount paid for the booking
 * @param policy - Cancellation policy steps
 * @param checkInDate - Check-in date
 * @param cancellationTime - When the cancellation is happening
 * @returns Refund amount in THB
 */
export function computeRefundAmount(
  totalPaid: number,
  policy: PolicyStep[],
  checkInDate: Date,
  cancellationTime: Date = new Date()
): number {
  const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
  return Math.round(totalPaid * (refundPct / 100));
}

/**
 * Resolve the cancellation policy for a booking snapshot from CONFIGURATION
 * (doc 04 §5): steps come from `[cfg] cancellation.policy.<key>`, the key
 * falls back to `[cfg] cancellation.default_policy`. Fails closed — an
 * unknown key or missing schedule throws instead of silently degrading to
 * the most generous policy.
 */
export async function resolveCancellationPolicy(
  db: PrismaClient,
  policyKey: string | null | undefined,
  scope?: { projectId?: string; unitId?: string }
): Promise<CancellationPolicy> {
  // `||` is deliberate here, and is not the hazard T-058 fixed elsewhere. That
  // hazard is about numbers, where a configured 0 is a real value that `||`
  // would discard. This value is a policy *name*: an empty string is not a
  // policy anyone can have configured on purpose, and falling through to the
  // default beats propagating it into "Unknown cancellation policy: ".
  const configuredDefault = (await getConfig(db, 'cancellation.default_policy', scope)) as
    | string
    | undefined;
  const key = policyKey || configuredDefault || 'moderate';

  const steps = (await getConfig(db, `cancellation.policy.${key}` as never, scope)) as
    | Array<{ days: number; pct: number }>
    | undefined;

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`Unknown cancellation policy: ${key}`);
  }

  return {
    name: key,
    steps: steps.map((s) => ({
      days_before_checkin: Number(s.days),
      refund_pct: Number(s.pct),
    })),
  };
}

/**
 * The cancellation policy a stay is actually sold under — ONE answer for the
 * unit page, the review page the guest consents on, and the booking snapshot.
 *
 * Precedence follows the canonical pricing graph: the active BAR RatePlan
 * (unit, then category, then project scope), then the InventoryCategory, then
 * the legacy Unit field, then the configured default. Before this, the booking
 * snapshotted only the Unit field (a copy of the category's policy taken when
 * the unit was written), while the unit and review pages fell back to a
 * hard-coded "Flexible cancellation" label — a guest could consent to
 * "flexible" and be bound by the configured default ("moderate").
 */
export async function resolveStayCancellationPolicy(
  db: PrismaClient,
  target: { unitId: string } | { inventoryCategoryId: string }
): Promise<CancellationPolicy> {
  let projectId: string;
  let unitId: string | null = null;
  let categoryId: string | null;
  let unitKey: string | null = null;
  let categoryKey: string | null = null;

  if ('unitId' in target) {
    const unit = await db.unit.findUnique({
      where: { id: target.unitId },
      select: {
        id: true, projectId: true, inventoryCategoryId: true, cancellationPolicyKey: true,
        inventoryCategory: { select: { cancellationPolicyKey: true } },
      },
    });
    if (!unit) throw new Error(`Unit ${target.unitId} not found`);
    projectId = unit.projectId;
    unitId = unit.id;
    categoryId = unit.inventoryCategoryId;
    unitKey = unit.cancellationPolicyKey;
    categoryKey = unit.inventoryCategory?.cancellationPolicyKey ?? null;
  } else {
    const category = await db.inventoryCategory.findUnique({
      where: { id: target.inventoryCategoryId },
      select: { id: true, projectId: true, cancellationPolicyKey: true },
    });
    if (!category) throw new Error(`Inventory category ${target.inventoryCategoryId} not found`);
    projectId = category.projectId;
    categoryId = category.id;
    categoryKey = category.cancellationPolicyKey;
  }

  const barPlans = await db.ratePlan.findMany({
    where: {
      code: 'BAR',
      status: 'active',
      OR: [
        ...(unitId ? [{ unitId }] : []),
        ...(categoryId ? [{ categoryId }] : []),
        { projectId, unitId: null, categoryId: null },
      ],
    },
    select: { unitId: true, categoryId: true, cancellationPolicyKey: true },
  });
  const planKey =
    barPlans.find(plan => unitId && plan.unitId === unitId)?.cancellationPolicyKey ??
    barPlans.find(plan => categoryId && plan.categoryId === categoryId)?.cancellationPolicyKey ??
    barPlans.find(plan => !plan.unitId && !plan.categoryId)?.cancellationPolicyKey ??
    null;

  return resolveCancellationPolicy(db, planKey || categoryKey || unitKey, {
    projectId,
    ...(unitId ? { unitId } : {}),
  });
}

/**
 * The doc 04 §5 default policy *shapes*, kept as documentation and test
 * fixtures. Runtime booking snapshots MUST use resolveCancellationPolicy —
 * the configuration layer is the source of truth, so founder edits to
 * `cancellation.policy.*` take effect without code changes.
 */
export const DEFAULT_POLICIES: Record<string, CancellationPolicy> = {
  flexible: {
    name: 'flexible',
    steps: [
      { days_before_checkin: 1, refund_pct: 100 },
      { days_before_checkin: 0, refund_pct: 0 },
    ],
  },
  moderate: {
    name: 'moderate',
    steps: [
      { days_before_checkin: 5, refund_pct: 100 },
      { days_before_checkin: 0, refund_pct: 50 },
    ],
  },
  strict: {
    name: 'strict',
    steps: [
      { days_before_checkin: 14, refund_pct: 50 },
      { days_before_checkin: 0, refund_pct: 0 },
    ],
  },
};

/**
 * A season's refund ladder from the source booking terms, as the policy the
 * booking snapshots. Null when the stay's terms carry no ladder, so the
 * configured policy applies. Founder ruling 2026-10-06: Layantara cancels by
 * arrival season (Green/Shoulder 14+ days full refund; High, Peak, EDC and
 * monthly non-refundable), not by one property-wide ladder.
 */
export function sourceSeasonCancellationPolicy(
  terms: { cancellationSteps?: Array<{ days: number; pct: number }> } | null | undefined
): CancellationPolicy | null {
  if (!terms?.cancellationSteps?.length) return null;
  return {
    name: 'season',
    steps: terms.cancellationSteps.map((s) => ({ days_before_checkin: s.days, refund_pct: s.pct })),
  };
}

/**
 * The policy a guest consents to for these exact dates — the same answer the
 * booking route snapshots. Quotes the stay (the unit, or any live unit of the
 * category: source terms are project-wide) and prefers the season ladder;
 * otherwise the configured policy (BAR plan > category > unit > default).
 */
export async function resolveStayCancellationPolicyForDates(
  db: PrismaClient,
  target: { unitId: string } | { inventoryCategoryId: string },
  stay: { startDate: Date; endDate: Date; guests: number }
): Promise<CancellationPolicy> {
  const unitId = 'unitId' in target
    ? target.unitId
    : (await db.unit.findFirst({
        where: { inventoryCategoryId: target.inventoryCategoryId, status: 'live' },
        select: { id: true },
        orderBy: { name: 'asc' },
      }))?.id;
  if (unitId) {
    const breakdown = await computePriceBreakdown(db, unitId, stay.startDate, stay.endDate, stay.guests)
      .catch(() => null);
    const season = sourceSeasonCancellationPolicy(breakdown?.commercialTerms);
    if (season) return season;
  }
  return resolveStayCancellationPolicy(db, target);
}
