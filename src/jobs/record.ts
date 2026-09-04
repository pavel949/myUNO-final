import type { PrismaClient } from '@prisma/client';
import { reportError } from '@/lib/observability';
import type { JobKey } from './registry';

const SUMMARY_MAX = 240;

export type JobRunRecord = {
  jobKey: JobKey;
  startedAt: Date;
  finishedAt: Date;
  outcome: 'ok' | 'failed';
  summary: string | null;
};

function clipSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const trimmed = summary.trim();
  if (!trimmed) return null;
  return trimmed.length > SUMMARY_MAX ? `${trimmed.slice(0, SUMMARY_MAX - 1)}…` : trimmed;
}

/**
 * Persist one job execution. Best-effort: a job that did its work must not
 * fail because the health row could not be written. The structured logger
 * still sees the write failure so it is not silent.
 */
export async function recordJobRun(db: PrismaClient, run: JobRunRecord): Promise<void> {
  try {
    await db.jobRun.create({
      data: {
        jobKey: run.jobKey,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        outcome: run.outcome,
        summary: clipSummary(run.summary),
      },
    });
  } catch (error) {
    reportError(error, {
      jobKey: run.jobKey,
      jobRunWriteFailed: true,
    });
  }
}

export type JobExecution<T> =
  | { ok: true; result: T; summary: string }
  | { ok: false; summary: string };

/**
 * Run a registered job, always writing a last-run row, and paging ops on
 * failure via `reportError` (doc 15 §5 — job failures were request-path only).
 *
 * Summaries are caller-supplied counts. Error messages are never stored:
 * Prisma failures can carry a connection string.
 */
export async function runRegisteredJob<T>(
  db: PrismaClient,
  jobKey: JobKey,
  work: () => Promise<T>,
  summarize: (result: T) => string
): Promise<JobExecution<T>> {
  const startedAt = new Date();
  try {
    const result = await work();
    const summary = summarize(result);
    await recordJobRun(db, {
      jobKey,
      startedAt,
      finishedAt: new Date(),
      outcome: 'ok',
      summary,
    });
    return { ok: true, result, summary };
  } catch (error) {
    reportError(error, { route: `job:${jobKey}`, jobKey });
    await recordJobRun(db, {
      jobKey,
      startedAt,
      finishedAt: new Date(),
      outcome: 'failed',
      summary: 'failed',
    });
    return { ok: false, summary: 'failed' };
  }
}
