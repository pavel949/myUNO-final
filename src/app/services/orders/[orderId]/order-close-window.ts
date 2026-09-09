/**
 * The orderer's confirm/dispute window, as data (doc 07 F-PROV-3).
 *
 * After the provider marks an order fulfilled the orderer has
 * `[cfg] service.fulfilment_confirm_window_hours` to say the work was done —
 * or to dispute it. When that lapses the order closes and stops accepting
 * disputes, so the page must not offer an action the server will refuse.
 *
 * Pure, so the page just renders and this test pins the semantics. The server
 * remains the authority: `confirmServiceOrderFulfilment` and `raiseDispute`
 * re-check the same rule, and this only decides what to show.
 */

/** Statuses whose grievance is not about fulfilment, so no window applies. */
const ALWAYS_DISPUTABLE = new Set(['accepted', 'failed']);

export interface CloseWindowState {
  /** The orderer may confirm the work was done, closing the order early. */
  canConfirm: boolean;
  /** The orderer may still raise a dispute. */
  canDispute: boolean;
  /** When the window ends; null when no window is running. */
  deadline: Date | null;
  /** Whole hours left in the window, floored at 0; null when not running. */
  hoursRemaining: number | null;
  /** The window ran out, or the order is already closed. */
  lapsed: boolean;
}

export function buildCloseWindowState(input: {
  status: string;
  fulfilledAt: Date | string | null;
  windowHours: number;
  hasDispute: boolean;
  now?: Date;
}): CloseWindowState {
  const { status, windowHours, hasDispute } = input;
  const now = input.now ?? new Date();

  // A closed order is finished: confirmed, or the window lapsed and the
  // sweep caught it. Either way there is nothing left to act on.
  if (status === 'closed') {
    return { canConfirm: false, canDispute: false, deadline: null, hoursRemaining: null, lapsed: true };
  }

  if (status !== 'fulfilled') {
    return {
      canConfirm: false,
      // An order disputed for reasons other than fulfilment — a provider who
      // never came, a charge on a cancelled order — has no fulfilment clock.
      canDispute: ALWAYS_DISPUTABLE.has(status) && !hasDispute,
      deadline: null,
      hoursRemaining: null,
      lapsed: false,
    };
  }

  const fulfilledAt = input.fulfilledAt ? new Date(input.fulfilledAt) : null;
  if (!fulfilledAt || Number.isNaN(fulfilledAt.getTime())) {
    // Fulfilled without a timestamp should not happen; treat the window as
    // open rather than silently stripping the orderer of their recourse.
    return {
      canConfirm: true,
      canDispute: !hasDispute,
      deadline: null,
      hoursRemaining: null,
      lapsed: false,
    };
  }

  const deadline = new Date(fulfilledAt.getTime() + windowHours * 60 * 60 * 1000);
  const lapsed = deadline <= now;
  const msRemaining = deadline.getTime() - now.getTime();

  return {
    canConfirm: !lapsed && !hasDispute,
    canDispute: !lapsed && !hasDispute,
    deadline,
    hoursRemaining: lapsed ? 0 : Math.floor(msRemaining / (60 * 60 * 1000)),
    lapsed,
  };
}
