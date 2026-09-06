/**
 * Money, in one place.
 *
 * ## The unit
 *
 * Every monetary amount in the domain layer, the database and the payment seam
 * is an **integer number of satang** (THB × 100). Never a float, never baht.
 * Floating-point baht cannot represent ฿0.10 exactly, and a ledger that is
 * append-only (doc 10) cannot be corrected by rounding later.
 *
 * Baht exists only at the edges: what a person reads on a screen, and what a
 * person types into a form. Those two conversions are what this module owns.
 *
 * ## Why it exists
 *
 * The conversion was reimplemented at every boundary — `revenueThisMonth /
 * 100` here, `Math.round(satang / 100)` there, a local `toBaht` in the payout
 * service, a local `formatCurrency` in a dozen screens. That duplication is
 * precisely how Q47 happened (producers handing satang to baht-expecting
 * formatters across owner, MC, admin, guest, provider and public screens) and
 * then Q49/Q50, its two write-path mirrors, where a provider's price edit and
 * an admin's NOI-cap entry were stored 100× too low.
 *
 * Fixing those one at a time treats the symptom. One implementation, used at
 * both edges, is the cause.
 *
 * ## The division that is not this
 *
 * `feePct / 100`, `markup_pct / 100`, `refundPct / 100` are percentage
 * arithmetic that happens to share a literal. They are not currency
 * conversions and must not be routed through here.
 *
 * ## Currency
 *
 * THB only — D11 in doc 01. `formatBaht` therefore hard-codes ฿ rather than
 * taking a currency parameter it could not honour. Q22 (non-THB owner payouts)
 * is what reopens that decision, and this module is where it would change.
 */

/** Satang per baht. Named so the ratio is never a bare literal at a call site. */
const SATANG_PER_BAHT = 100;

function assertFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${what} must be a finite number, got ${value}`);
  }
}

/**
 * Satang → whole baht, for display.
 *
 * Rounds rather than truncates: ฿99.99 shown as ฿99 reads as an error to the
 * person holding the invoice, and truncation biases every displayed total
 * downward. The satang value remains the record; this is only what is shown.
 */
export function satangToBaht(satang: number): number {
  assertFinite(satang, 'satang');
  return Math.round(satang / SATANG_PER_BAHT);
}

/**
 * Baht → satang, for storage.
 *
 * The write-path direction, and the one that caused Q49/Q50 by being absent:
 * a form collects baht, and anything that stores it without this multiplication
 * stores an amount 100× too small — silently, because the number still looks
 * plausible.
 *
 * Fractional baht is refused rather than rounded. A price of ฿1,234.567 is a
 * caller mistake, and quietly turning it into ฿1,234.57 hides the mistake in a
 * financial record.
 */
export function bahtToSatang(baht: number): number {
  assertFinite(baht, 'baht');
  const satang = baht * SATANG_PER_BAHT;
  if (!Number.isInteger(satang)) {
    throw new Error(
      `Baht amount ${baht} is not a whole number of satang; round it before storing.`
    );
  }
  return satang;
}

/**
 * Satang → a displayable baht string: `฿1,234`, negatives as `−฿1,234`.
 *
 * For places that render text rather than JSX — notification bodies, CSV
 * exports, iCal descriptions. React screens use the `MoneyAmount` component
 * (doc 06 §3.1), which formats through this same function so a figure never
 * depends on where it is shown.
 *
 * The minus is U+2212, not a hyphen: it aligns with digits in tabular figures.
 */
export function formatBaht(satang: number): string {
  const baht = satangToBaht(satang);
  const formatted = `฿${Math.abs(baht).toLocaleString('en-US')}`;
  return baht < 0 ? `−${formatted}` : formatted;
}

/**
 * Satang → an abbreviated baht string: `฿1.2M`, `฿45.0K`, `฿800`.
 *
 * For dense surfaces where a full figure would crowd the layout — pipeline
 * cards, stage column headers, dashboard tiles. Exact figures belong in
 * `formatBaht`; this one deliberately loses precision, so it must never be
 * used where someone reconciles a number against a record.
 *
 * It existed as four near-identical copies across the CRM screens, differing
 * only in whether the sub-thousand branch called `toFixed(0)` — the same
 * duplication that produced Q47.
 */
export function formatBahtCompact(satang: number): string {
  const baht = satangToBaht(satang);
  const sign = baht < 0 ? '−' : '';
  const magnitude = Math.abs(baht);
  if (magnitude >= 1_000_000) return `${sign}฿${(magnitude / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${sign}฿${(magnitude / 1_000).toFixed(1)}K`;
  return `${sign}฿${magnitude}`;
}
