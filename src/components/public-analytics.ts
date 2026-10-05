export const PUBLIC_ANALYTICS_EVENTS = {
  intentSelected: 'intent_selected',
  searchSubmitted: 'search_submitted',
  resultOpened: 'result_opened',
  ownerGoalSelected: 'owner_goal_selected',
  leadStarted: 'lead_started',
} as const;

export type PublicAnalyticsEvent =
  | 'intent_selected'
  | 'search_submitted'
  | 'result_opened'
  | 'owner_goal_selected'
  | 'lead_started';

export type PublicAnalyticsDimensions = Record<
  string,
  string | number | boolean | null | undefined
>;

export function trackPublicInteraction(
  eventKey: PublicAnalyticsEvent,
  dimensions: PublicAnalyticsDimensions = {},
): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ eventKey, dimensions });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/public',
        new Blob([payload], { type: 'application/json' }),
      );
      return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }
  void fetch('/api/analytics/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function deviceClass(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 639px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}
