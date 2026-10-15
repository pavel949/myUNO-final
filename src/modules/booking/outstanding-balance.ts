/** Stored balances remain unchanged while imported source claims await review.
 * This projection returns collectible money only, never a claim that a stay is paid.
 * Callers displaying a balance must also display pending reconciliation explicitly.
 */
export function outstandingStayBalanceSatang(booking: { status: string; totalThb: number; balanceDueThb: number; receivableStatus: string }): number {
  if (booking.receivableStatus !== 'collectible') return 0;
  const amount = booking.status === 'pending_payment' ? booking.totalThb
    : ['confirmed', 'checked_in', 'checked_out'].includes(booking.status) ? booking.balanceDueThb : 0;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

/** Command guard; invoke after taking the canonical booking/inventory lock. */
export function assertStayReceivableCollectible(booking: { receivableStatus: string }): void {
  if (booking.receivableStatus !== 'collectible') {
    throw Object.assign(new Error('The source payment and guest balance need reconciliation before collecting money.'), {
      code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED',
    });
  }
}
