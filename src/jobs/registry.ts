/**
 * The scheduled-job registry (doc 14 §1, doc 15 §5).
 *
 * Every background job the platform actually runs is named here. The admin
 * health panel lists this set even when no row has ever been written — a job
 * that has never run is a red light, not an empty table.
 *
 * ## Two schedulers, one registry
 *
 * Doc 15 asks for hold expiry every 5 minutes and iCal import every 15. The
 * production project is on Vercel Hobby, which refuses any cron firing more
 * than once per day — a 15-minute expression fails the deploy outright. That
 * left holds sitting expired for up to 24 hours and OTA calendars up to 24
 * hours stale, which is an operational defect, not a future one.
 *
 * The fix costs nothing (T-047). `/api/cron/run-frequent` is an ordinary
 * authenticated route (`CRON_SECRET`, see `auth.ts`), so anything that can
 * make an HTTPS request can drive it. `.github/workflows/scheduler.yml` calls
 * it from GitHub Actions on the real cadence, for free. The two Vercel crons
 * stay as a backstop: if GitHub is down, the schedule degrades to daily
 * rather than stopping.
 *
 * `SCHEDULER_MODE` tells the health panel which of those is actually live:
 *
 *   external      — the GitHub Actions workflow is running. Silence
 *                   thresholds tighten to the real cadence, so a stalled
 *                   scheduler shows up in minutes.
 *   vercel-daily  — (default) only the Vercel daily crons. Thresholds stay
 *                   at two days, because anything tighter would paint the
 *                   panel red on a schedule that is working as configured.
 *
 * The default is the conservative one deliberately: an unset variable must
 * never invent an alarm. Set `SCHEDULER_MODE=external` in Vercel only once
 * the workflow is confirmed firing.
 */

export const JOB_KEYS = {
  bookingLifecycle: 'booking_lifecycle',
  tm30Escalations: 'tm30_escalations',
  icalSync: 'ical_sync',
  verificationDeadlines: 'verification_deadlines',
  retention: 'retention',
  metricsRollup: 'metrics_rollup',
  guestLifecycle: 'guest_lifecycle',
  serviceOrderExpiry: 'service_order_expiry',
} as const;

export type JobKey = (typeof JOB_KEYS)[keyof typeof JOB_KEYS];

export type JobCadence = 'frequent' | 'nightly';

export type SchedulerMode = 'external' | 'vercel-daily';

export interface JobDefinition {
  key: JobKey;
  cadence: JobCadence;
  /** The cadence doc 15 asks for, independent of what is driving it today. */
  intendedIntervalMs: number;
  /** Age of the last run after which the panel treats the job as silent. */
  maxSilenceMs: number;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How much lateness is not yet a fault.
 *
 * GitHub's scheduled workflows are best-effort: they queue behind the
 * platform's own load and routinely fire minutes late, occasionally much
 * later. Six intervals of slack keeps a genuinely stalled scheduler visible
 * within half an hour on the frequent jobs while leaving ordinary jitter
 * alone. A tighter window would train people to ignore the panel, which is
 * worse than a slower alarm.
 */
const EXTERNAL_SILENCE_FACTOR = 6;

/** Both slots fire once a day under Vercel Hobby; one missed tick is a warning. */
const VERCEL_DAILY_SILENCE_MS = 2 * DAY_MS;

export function schedulerMode(): SchedulerMode {
  return process.env.SCHEDULER_MODE === 'external' ? 'external' : 'vercel-daily';
}

export interface JobSpec {
  key: JobKey;
  cadence: JobCadence;
  intendedIntervalMs: number;
}

const JOB_SPECS: readonly JobSpec[] = [
  // Doc 15: hold expiry every 5 minutes. A hold that outlives its window is
  // inventory nobody can book, so this is the tightest cadence in the system.
  { key: JOB_KEYS.bookingLifecycle, cadence: 'frequent', intendedIntervalMs: 5 * MINUTE_MS },
  // TM30 is a 24-hour statutory deadline with escalation; checking every 15
  // minutes is what makes the escalation land before the deadline, not after.
  { key: JOB_KEYS.tm30Escalations, cadence: 'frequent', intendedIntervalMs: 15 * MINUTE_MS },
  // Doc 15: iCal import every 15 minutes. Slower means double bookings.
  { key: JOB_KEYS.icalSync, cadence: 'frequent', intendedIntervalMs: 15 * MINUTE_MS },
  { key: JOB_KEYS.verificationDeadlines, cadence: 'nightly', intendedIntervalMs: DAY_MS },
  { key: JOB_KEYS.retention, cadence: 'nightly', intendedIntervalMs: DAY_MS },
  { key: JOB_KEYS.metricsRollup, cadence: 'nightly', intendedIntervalMs: DAY_MS },
  { key: JOB_KEYS.guestLifecycle, cadence: 'nightly', intendedIntervalMs: DAY_MS },
  { key: JOB_KEYS.serviceOrderExpiry, cadence: 'nightly', intendedIntervalMs: DAY_MS },
];

/**
 * Nightly jobs run once a day under both schedulers, so their threshold does
 * not move — only the frequent slot is affected by which scheduler is live.
 */
export function resolveMaxSilenceMs(spec: JobSpec, mode: SchedulerMode): number {
  if (spec.cadence === 'nightly') return VERCEL_DAILY_SILENCE_MS;
  return mode === 'external'
    ? spec.intendedIntervalMs * EXTERNAL_SILENCE_FACTOR
    : VERCEL_DAILY_SILENCE_MS;
}

export function buildJobs(mode: SchedulerMode): readonly JobDefinition[] {
  return JOB_SPECS.map((spec) => ({
    key: spec.key,
    cadence: spec.cadence,
    intendedIntervalMs: spec.intendedIntervalMs,
    maxSilenceMs: resolveMaxSilenceMs(spec, mode),
  }));
}

export const JOBS: readonly JobDefinition[] = buildJobs(schedulerMode());

export function jobDefinition(key: JobKey): JobDefinition {
  const found = JOBS.find((job) => job.key === key);
  if (!found) {
    throw new Error(`Unknown scheduler job: ${key}`);
  }
  return found;
}
