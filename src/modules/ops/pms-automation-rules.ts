/**
 * Side-effect-free PMS automation decision layer.
 * The caller must authenticate, authorize and enqueue durable jobs separately.
 * Never use these suggestions to mutate bookings, payments or readiness.
 */
export type PmsAutomationEvent =
  | { type: 'booking.pending_payment'; bookingId: string; expiresAt: string | null; now: string }
  | { type: 'stay.checked_out'; bookingId: string; unitId: string }
  | { type: 'maintenance.blocked'; taskId: string; unitId: string }
  | { type: 'stay.arrival_soon'; bookingId: string; unitId: string; readiness: 'ready' | 'blocked' | 'unknown' };

export type PmsAutomationSuggestion = {
  key: string;
  kind: 'notify_payment' | 'create_turnover_task' | 'alert_maintenance' | 'alert_arrival_blocker';
  subjectId: string;
  reason: string;
};

/** Deterministic decisions; no DB access or side effects. */
export function suggestPmsActions(event: PmsAutomationEvent): PmsAutomationSuggestion[] {
  switch (event.type) {
    case 'booking.pending_payment': {
      if (!event.expiresAt) return [];
      const expiry = Date.parse(event.expiresAt);
      const now = Date.parse(event.now);
      if (!Number.isFinite(expiry) || !Number.isFinite(now) || expiry <= now) return [];
      return [{ key: 'payment:'+event.bookingId+':'+event.expiresAt, kind: 'notify_payment', subjectId: event.bookingId, reason: 'Payment deadline approaching' }];
    }
    case 'stay.checked_out':
      return [{ key: 'turnover:'+event.bookingId, kind: 'create_turnover_task', subjectId: event.unitId, reason: 'Departure requires cleaning and inspection' }];
    case 'maintenance.blocked':
      return [{ key: 'maintenance:'+event.taskId, kind: 'alert_maintenance', subjectId: event.unitId, reason: 'Blocking maintenance needs operator attention' }];
    case 'stay.arrival_soon':
      return event.readiness === 'ready' ? [] : [{
        key: 'arrival:'+event.bookingId+':'+event.readiness,
        kind: 'alert_arrival_blocker', subjectId: event.unitId,
        reason: event.readiness === 'blocked' ? 'Arrival has a readiness blocker' : 'Arrival readiness has not been verified',
      }];
  }
}
