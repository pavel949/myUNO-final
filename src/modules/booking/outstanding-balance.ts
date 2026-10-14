/** Booking money is stored in satang. Cancelled/declined/expired reservations
 * do not become collectible debt merely because historical balance is retained.
 */
export function outstandingStayBalanceSatang(booking: { status: string; totalThb: number; balanceDueThb: number }): number {
  const amount = booking.status === 'pending_payment' ? booking.totalThb
    : ['confirmed', 'checked_in', 'checked_out'].includes(booking.status) ? booking.balanceDueThb : 0;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}
