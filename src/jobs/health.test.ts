import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOBS, JOB_KEYS, jobDefinition } from './registry';
import { evaluateJobHealth, jobsNeedingAttention } from './health';

const NOW = new Date('2026-09-04T12:00:00Z');

function run(overrides: Partial<{ startedAt: Date; finishedAt: Date; outcome: 'ok' | 'failed'; summary: string | null }>) {
  const finishedAt = overrides.finishedAt ?? NOW;
  return {
    startedAt: overrides.startedAt ?? finishedAt,
    finishedAt,
    outcome: overrides.outcome ?? 'ok',
    summary: overrides.summary ?? 'ok',
  };
}

describe('the scheduler registry', () => {
  it('names every job once', () => {
    const keys = JOBS.map((job) => job.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(Object.values(JOB_KEYS).slice().sort());
  });

  it('has a content key for every registered job, so the panel never invents a label', () => {
    const seed = readFileSync(join(process.cwd(), 'src/modules/content/seed.ts'), 'utf8');
    for (const job of JOBS) {
      expect(seed).toContain(`admin.scheduler.job.${job.key}`);
    }
  });

  it('throws on an unknown key rather than inventing a cadence', () => {
    expect(() => jobDefinition('not_a_job' as never)).toThrow(/Unknown scheduler job/);
  });
});

describe('evaluateJobHealth', () => {
  const frequent = JOBS.find((job) => job.key === JOB_KEYS.bookingLifecycle)!;
  const nightly = JOBS.find((job) => job.key === JOB_KEYS.retention)!;

  it('is never when the job has no row — a silent scheduler is a red light', () => {
    const health = evaluateJobHealth(frequent, null, NOW);
    expect(health.status).toBe('never');
    expect(health.lastOutcome).toBeNull();
  });

  it('is ok when the last success is inside the silence window', () => {
    const health = evaluateJobHealth(
      frequent,
      run({ finishedAt: new Date(NOW.getTime() - 5 * 60 * 1000) }),
      NOW
    );
    expect(health.status).toBe('ok');
    expect(health.lastOutcome).toBe('ok');
  });

  it('is silent when the last success is older than 2× cadence', () => {
    const health = evaluateJobHealth(
      frequent,
      run({ finishedAt: new Date(NOW.getTime() - frequent.maxSilenceMs - 1) }),
      NOW
    );
    expect(health.status).toBe('silent');
  });

  it('is failed when the last run threw, even if that run is also stale', () => {
    const health = evaluateJobHealth(
      nightly,
      run({
        outcome: 'failed',
        summary: 'failed',
        finishedAt: new Date(NOW.getTime() - nightly.maxSilenceMs * 3),
      }),
      NOW
    );
    expect(health.status).toBe('failed');
  });

  it('keeps a nightly job green for a day, not for 15 minutes', () => {
    const health = evaluateJobHealth(
      nightly,
      run({ finishedAt: new Date(NOW.getTime() - 20 * 60 * 60 * 1000) }),
      NOW
    );
    expect(health.status).toBe('ok');
  });
});

describe('jobsNeedingAttention', () => {
  it('counts everything that is not on schedule', () => {
    const frequent = JOBS.find((job) => job.key === JOB_KEYS.bookingLifecycle)!;
    const rows = [
      evaluateJobHealth(frequent, run({ finishedAt: NOW }), NOW),
      evaluateJobHealth(frequent, null, NOW),
    ];
    expect(jobsNeedingAttention(rows).map((r) => r.status)).toEqual(['never']);
  });
});
