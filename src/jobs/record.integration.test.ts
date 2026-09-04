import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb } from '@/test/util';
import {
  JOBS,
  JOB_KEYS,
  getSchedulerHealth,
  runRegisteredJob,
  isCronAuthorized,
} from './index';

describe('isCronAuthorized', () => {
  const previous = process.env.CRON_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it('refuses when CRON_SECRET is unset, even with Bearer undefined', () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/run-all', {
      headers: { authorization: 'Bearer undefined' },
    });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('accepts the Vercel Cron bearer header', () => {
    process.env.CRON_SECRET = 'test-secret';
    const req = new NextRequest('http://localhost/api/cron/run-all', {
      headers: { authorization: 'Bearer test-secret' },
    });
    expect(isCronAuthorized(req)).toBe(true);
  });

  it('accepts the legacy X-Cron-Secret header used by one dedicated route', () => {
    process.env.CRON_SECRET = 'test-secret';
    const req = new NextRequest('http://localhost/api/cron/expire-service-orders', {
      headers: { 'x-cron-secret': 'test-secret' },
    });
    expect(isCronAuthorized(req)).toBe(true);
  });
});

describe('job_run last-run ledger', () => {
  const previousSilent = process.env.LOG_SILENT;

  beforeEach(async () => {
    process.env.LOG_SILENT = '1';
    await resetDb();
  });

  afterEach(() => {
    if (previousSilent === undefined) delete process.env.LOG_SILENT;
    else process.env.LOG_SILENT = previousSilent;
  });

  it('lists every registered job as never-run when the table is empty', async () => {
    const health = await getSchedulerHealth(db, new Date('2026-09-04T12:00:00Z'));
    expect(health.map((row) => row.key).sort()).toEqual(JOBS.map((job) => job.key).sort());
    expect(health.every((row) => row.status === 'never')).toBe(true);
  });

  it('records success and surfaces it as on-schedule', async () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const result = await runRegisteredJob(
      db,
      JOB_KEYS.retention,
      async () => ({ deleted: 2 }),
      (r) => `${r.deleted} media`
    );
    expect(result.ok).toBe(true);

    const health = await getSchedulerHealth(db, now);
    const retention = health.find((row) => row.key === JOB_KEYS.retention);
    expect(retention?.status).toBe('ok');
    expect(retention?.lastOutcome).toBe('ok');
    expect(retention?.summary).toBe('2 media');
  });

  it('records failure without storing the thrown message', async () => {
    const result = await runRegisteredJob(
      db,
      JOB_KEYS.icalSync,
      async () => {
        throw new Error('postgresql://postgres:secret@db.example/postgres');
      },
      () => 'should not run'
    );
    expect(result.ok).toBe(false);

    const row = await db.jobRun.findFirst({ where: { jobKey: JOB_KEYS.icalSync } });
    expect(row?.outcome).toBe('failed');
    expect(row?.summary).toBe('failed');
    expect(row?.summary).not.toContain('secret');
    expect(row?.summary).not.toContain('postgresql');
  });

  it('keeps the latest row as the one the panel reads', async () => {
    await runRegisteredJob(db, JOB_KEYS.bookingLifecycle, async () => 1, () => 'first');
    await runRegisteredJob(db, JOB_KEYS.bookingLifecycle, async () => 2, () => 'second');

    const health = await getSchedulerHealth(db);
    const booking = health.find((row) => row.key === JOB_KEYS.bookingLifecycle);
    expect(booking?.summary).toBe('second');
    expect(await db.jobRun.count({ where: { jobKey: JOB_KEYS.bookingLifecycle } })).toBe(2);
  });
});
