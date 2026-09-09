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
const ALWAYS_DISPUTABLE = new Set(['accepted', 'failed', 'cancelled']);

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

  if (status === 'closed') {
    return { canConfirm: false, canDispute: false, deadline: null, hoursRemaining: null, lapsed: true };
  }

  if (status !== 'fulfilled') {
    return {
      canConfirm: false,
      canDispute: ALWAYS_DISPUTABLE.has(status) && !hasDispute,
      deadline: null,
      hoursRemaining: null,
      lapsed: false,
    };
  }

  const fulfilledAt = input.fulfilledAt ? new Date(input.fulfilledAt) : null;
  if (!fulfilledAt || Number.isNaN(fulfilledAt.getTime())) {
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
