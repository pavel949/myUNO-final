/**
 * Cancellation policy and refund calculation.
 * Policies are snapshots taken at booking time.
 */

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
  // Calculate days from cancellation to check-in
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilCheckIn = Math.ceil(
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
 * Default cancellation policies.
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
