/**
 * The scheduled-job registry (doc 14 §1, doc 15 §5).
 *
 * Every background job the platform actually runs is named here. The admin
 * health panel lists this set even when no row has ever been written — a job
 * that has never run is a red light, not an empty table.
 *
 * Cadence matches `vercel.json` (Hobby allows two cron slots):
 *   frequent — `/api/cron/run-frequent` every 15 minutes
 *   nightly  — `/api/cron/run-all` at 19:00 UTC (02:00 ICT)
 *
 * Doc 15 asks for hold expiry every 5 minutes. The two-slot ceiling packs
 * holds, TM30 and iCal into the 15-minute slot (the same constraint the
 * nightly dispatcher already documents). Silence thresholds are 2× cadence
 * so one missed tick is a warning, two is overdue.
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

export interface JobDefinition {
  key: JobKey;
  cadence: JobCadence;
  /** Age of the last run after which the panel treats the job as silent. */
  maxSilenceMs: number;
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const JOBS: readonly JobDefinition[] = [
  {
    key: JOB_KEYS.bookingLifecycle,
    cadence: 'frequent',
    maxSilenceMs: 2 * FIFTEEN_MIN_MS,
  },
  {
    key: JOB_KEYS.tm30Escalations,
    cadence: 'frequent',
    maxSilenceMs: 2 * FIFTEEN_MIN_MS,
  },
  {
    key: JOB_KEYS.icalSync,
    cadence: 'frequent',
    maxSilenceMs: 2 * FIFTEEN_MIN_MS,
  },
  {
    key: JOB_KEYS.verificationDeadlines,
    cadence: 'nightly',
    maxSilenceMs: 2 * DAY_MS,
  },
  {
    key: JOB_KEYS.retention,
    cadence: 'nightly',
    maxSilenceMs: 2 * DAY_MS,
  },
  {
    key: JOB_KEYS.metricsRollup,
    cadence: 'nightly',
    maxSilenceMs: 2 * DAY_MS,
  },
  {
    key: JOB_KEYS.guestLifecycle,
    cadence: 'nightly',
    maxSilenceMs: 2 * DAY_MS,
  },
  {
    key: JOB_KEYS.serviceOrderExpiry,
    cadence: 'nightly',
    maxSilenceMs: 2 * DAY_MS,
  },
];

export function jobDefinition(key: JobKey): JobDefinition {
  const found = JOBS.find((job) => job.key === key);
  if (!found) {
    throw new Error(`Unknown scheduler job: ${key}`);
  }
  return found;
}
