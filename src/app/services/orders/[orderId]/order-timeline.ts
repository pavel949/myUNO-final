/**
 * SA-4: the order's status journey as data — placed → paid → accepted →
 * fulfilled, with cancelled/declined/expired/failed as terminal branches.
 * Pure so the page just renders and the test pins the semantics.
 */

export const ORDER_JOURNEY = ['placed', 'paid', 'accepted', 'fulfilled'] as const;
const TERMINAL_BRANCHES = new Set(['cancelled', 'declined', 'expired', 'failed']);

export interface TimelineStep {
  key: (typeof ORDER_JOURNEY)[number];
  done: boolean;
  current: boolean;
}

export interface OrderTimeline {
  steps: TimelineStep[];
  /** Set when the order left the happy path (cancelled/declined/expired/failed). */
  terminal: string | null;
}

export function buildOrderTimeline(status: string): OrderTimeline {
  if (TERMINAL_BRANCHES.has(status)) {
    // The journey stops where it was; the terminal state renders separately.
    return {
      steps: ORDER_JOURNEY.map((key) => ({ key, done: false, current: false })),
      terminal: status,
    };
  }
  // closed counts as the journey fully walked
  const effective = status === 'closed' ? 'fulfilled' : status;
  const idx = ORDER_JOURNEY.indexOf(effective as (typeof ORDER_JOURNEY)[number]);
  return {
    steps: ORDER_JOURNEY.map((key, i) => ({
      key,
      done: idx >= 0 && i < idx,
      current: i === idx,
    })),
    terminal: null,
  };
}
