import type { PrismaClient } from '@prisma/client';
import { JOBS, type JobCadence, type JobDefinition, type JobKey } from './registry';

export type JobHealthStatus = 'ok' | 'failed' | 'silent' | 'never';

export interface JobLastRun {
  startedAt: Date;
  finishedAt: Date;
  outcome: 'ok' | 'failed';
  summary: string | null;
}

export interface JobHealth {
  key: JobKey;
  cadence: JobCadence;
  status: JobHealthStatus;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOutcome: 'ok' | 'failed' | null;
  summary: string | null;
}

/**
 * Pure: given a job and its latest row (or none), decide the panel colour.
 *
 * - never  — no row at all (scheduler has not reported in)
 * - failed — last run threw
 * - silent — last run succeeded, but longer ago than 2× cadence
 * - ok     — last run succeeded inside the silence window
 *
 * A failed run that is also stale stays `failed` — that is the more specific
 * signal. Both are red; the panel must not hide a crash behind "overdue".
 */
export function evaluateJobHealth(
  job: JobDefinition,
  lastRun: JobLastRun | null,
  now: Date
): JobHealth {
  if (!lastRun) {
    return {
      key: job.key,
      cadence: job.cadence,
      status: 'never',
      lastStartedAt: null,
      lastFinishedAt: null,
      lastOutcome: null,
      summary: null,
    };
  }

  const ageMs = now.getTime() - lastRun.finishedAt.getTime();
  const stale = ageMs > job.maxSilenceMs;
  const status: JobHealthStatus =
    lastRun.outcome === 'failed' ? 'failed' : stale ? 'silent' : 'ok';

  return {
    key: job.key,
    cadence: job.cadence,
    status,
    lastStartedAt: lastRun.startedAt,
    lastFinishedAt: lastRun.finishedAt,
    lastOutcome: lastRun.outcome,
    summary: lastRun.summary,
  };
}

export async function getSchedulerHealth(
  db: PrismaClient,
  now: Date = new Date()
): Promise<JobHealth[]> {
  const latest = await Promise.all(
    JOBS.map((job) =>
      db.jobRun.findFirst({
        where: { jobKey: job.key },
        orderBy: { startedAt: 'desc' },
        select: {
          startedAt: true,
          finishedAt: true,
          outcome: true,
          summary: true,
        },
      })
    )
  );

  return JOBS.map((job, index) => {
    const row = latest[index];
    const lastRun: JobLastRun | null = row
      ? {
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          outcome: row.outcome,
          summary: row.summary,
        }
      : null;
    return evaluateJobHealth(job, lastRun, now);
  });
}

export function jobsNeedingAttention(health: JobHealth[]): JobHealth[] {
  return health.filter((row) => row.status !== 'ok');
}
