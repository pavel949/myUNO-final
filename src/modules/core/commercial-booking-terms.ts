/**
 * Source policy is evidence, not permission to book. Resolve it from a
 * versioned CommercialOffering policy snapshot after commercial approval.
 * All Layantara source rules are project-scoped by rate mode/season; future
 * adapters must normalize category/unit scoped terms before this boundary.
 */
export type SourceBookingTerms = {
  sourcePolicyId: string;
  rateMode: 'daily' | 'monthly' | 'yearly';
  seasonCode: string | null;
  minimumNights: number;
  confirmationPaymentType: string;
  confirmationPaymentValue: number;
  cancellationSummary: string;
  balanceTiming: string;
  securityDepositThbSatang: number;
  securityDepositUsdCents: number;
  amendmentsAllowed: boolean;
  included: string[];
  excluded: string[];
  stayTerms: string;
  /**
   * The season's refund ladder over what the guest has paid, as
   * [{ days, pct }] from most to least days before check-in. Optional: a
   * source rule without one keeps the configured cancellation policy.
   * Founder ruling 2026-10-06: Layantara cancels by arrival season.
   */
  cancellationSteps?: Array<{ days: number; pct: number }>;
};
export function resolveSourceBookingTerms(
  rules: unknown, mode: SourceBookingTerms['rateMode'], seasonCode: string,
): SourceBookingTerms {
  if (!Array.isArray(rules)) throw new Error('Booking terms missing');
  const matches = rules.filter(r =>
    r && typeof r === 'object' && r.active === true &&
    r.scope_type === 'project' && r.rate_mode === mode &&
    (r.season_code === null || r.season_code === seasonCode)
  );
  // Specific season rule wins over generic mode rule. A tie is ambiguous.
  const specific = matches.filter(r => r.season_code === seasonCode);
  const selected = specific.length ? specific : matches;
  if (selected.length !== 1) throw new Error('Missing or conflicting booking policy');
  const r = selected[0];
  const min = Number(r.min_nights ?? 1);
  const percent = Number(r.confirmation_payment_value ?? r.payment_percent_to_confirm);
  const deposit = Number(r.security_deposit_thb ?? 0);
  const depositUsd = Number(r.security_deposit_usd ?? 0);
  if (!r.id || !Number.isSafeInteger(min) || min < 1 ||
      !Number.isFinite(percent) || percent < 0 || percent > 100 ||
      !Number.isFinite(deposit) || deposit < 0 ||
      !Number.isFinite(depositUsd) || depositUsd < 0 ||
      typeof r.cancellation_summary !== 'string' || !r.cancellation_summary.trim() ||
      typeof r.balance_timing !== 'string' ||
      typeof r.stay_terms !== 'string' ||
      !Array.isArray(r.included) || !Array.isArray(r.excluded))
    throw new Error('Incomplete source booking terms');
  let cancellationSteps: SourceBookingTerms['cancellationSteps'];
  if (r.cancellation_steps !== undefined && r.cancellation_steps !== null) {
    const steps = r.cancellation_steps;
    const valid = Array.isArray(steps) && steps.length > 0 && steps.every((step: unknown) => {
      const st = step as { days?: unknown; pct?: unknown };
      return Number.isSafeInteger(st?.days) && (st.days as number) >= 0 &&
        Number.isFinite(st?.pct) && (st.pct as number) >= 0 && (st.pct as number) <= 100;
    }) && steps.every((step: { days: number }, i: number) => i === 0 || step.days < steps[i - 1].days);
    // A malformed ladder must fail closed, never silently refund nothing or everything.
    if (!valid) throw new Error('Invalid source cancellation steps');
    cancellationSteps = steps.map((step: { days: number; pct: number }) => ({ days: step.days, pct: step.pct }));
  }
  return {
    ...(cancellationSteps ? { cancellationSteps } : {}),
    sourcePolicyId: r.id,
    rateMode: mode,
    seasonCode: r.season_code ?? null,
    minimumNights: min,
    confirmationPaymentType: String(r.confirmation_payment_type ?? 'percentage'),
    confirmationPaymentValue: percent,
    cancellationSummary: r.cancellation_summary,
    balanceTiming: r.balance_timing,
    securityDepositThbSatang: Math.round(deposit * 100),
    securityDepositUsdCents: Math.round(depositUsd * 100),
    amendmentsAllowed: r.amendments_allowed === true,
    included: r.included,
    excluded: r.excluded,
    stayTerms: r.stay_terms,
  };
}
