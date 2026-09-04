import type { PrismaClient } from '@prisma/client';
import { checkVerificationDeadlines, checkTm30Escalations } from '@/modules/ops';
import { runRetentionJobs } from '@/modules/core';
import { rollupMetricsDaily, detectBuyerSignals } from '@/modules/analytics';
import {
  expireHolds,
  autoDeclineRequests,
  sendPrearrivalReminders,
  sendPostStayPrompts,
} from '@/modules/booking';
import { expireStaleServiceOrders } from '@/modules/services';
import { syncAllICalAccounts } from '@/modules/integrations';
import { getConfig } from '@/modules/config';
import { JOB_KEYS } from './registry';
import { runRegisteredJob } from './record';

export type JobDispatchResult = Record<string, string>;

function mark(results: JobDispatchResult, key: string, ok: boolean, summary: string): void {
  results[key] = ok ? `ok (${summary})` : 'failed';
}

export async function runBookingLifecycleJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.bookingLifecycle,
    async () => {
      const expired = await expireHolds(db);
      const declined = await autoDeclineRequests(db);
      return { expired, declined };
    },
    (r) => `${r.expired} holds expired, ${r.declined} requests auto-declined`
  );
}

export async function runTm30EscalationsJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.tm30Escalations,
    async () => {
      const projects = await db.project.findMany({
        where: { status: 'live' },
        select: { id: true },
      });
      let checked = 0;
      let escalated = 0;
      for (const project of projects) {
        const result = await checkTm30Escalations(db, project.id);
        checked += result.checked;
        escalated += result.escalated;
      }
      return { checked, escalated };
    },
    (r) => `${r.checked} checked, ${r.escalated} escalated`
  );
}

export async function runIcalSyncJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.icalSync,
    () => syncAllICalAccounts(db),
    (r) =>
      `${r.synced} synced, ${r.failed} failed, ${r.imported} imported, ${r.conflicts} conflicts`
  );
}

export async function runVerificationDeadlinesJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.verificationDeadlines,
    () => checkVerificationDeadlines(db),
    (r) => `${r.checked} checked, ${r.failed} marked failed`
  );
}

export async function runRetentionJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.retention,
    () => runRetentionJobs(db),
    (r) =>
      `${r.deletedMedia} media, ${r.anonymizedIdentities} identities, ${r.expiredTokens} tokens, ${r.scrubbedPassports} passports`
  );
}

export async function runMetricsRollupJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.metricsRollup,
    async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await rollupMetricsDaily(db, yesterday);
      await detectBuyerSignals(db);
      return { date: yesterday.toISOString().slice(0, 10) };
    },
    (r) => `rolled up ${r.date}`
  );
}

export async function runGuestLifecycleJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.guestLifecycle,
    async () => {
      const prearrival = await sendPrearrivalReminders(db);
      const postStay = await sendPostStayPrompts(db);
      return { prearrival, postStay };
    },
    (r) => `${r.prearrival} pre-arrival, ${r.postStay} post-stay`
  );
}

export async function runServiceOrderExpiryJob(db: PrismaClient) {
  return runRegisteredJob(
    db,
    JOB_KEYS.serviceOrderExpiry,
    async () => {
      const slaHours = (await getConfig(db, 'service.accept_sla_hours')) as number | null;
      return expireStaleServiceOrders(db, slaHours ?? 12);
    },
    (r) => `${r.expired} expired, ${r.refunded} refunded`
  );
}

/**
 * Frequent slot: holds, TM30 SLA, iCal import.
 * Scheduled daily at `/api/cron/run-frequent` (Hobby cannot fire more often).
 *
 * iCal is last: each feed may block for 15s, and that must not starve
 * hold expiry or TM30 on the same invocation.
 */
export async function runFrequentJobs(db: PrismaClient): Promise<JobDispatchResult> {
  const results: JobDispatchResult = {};

  const booking = await runBookingLifecycleJob(db);
  mark(results, JOB_KEYS.bookingLifecycle, booking.ok, booking.summary);

  const tm30 = await runTm30EscalationsJob(db);
  mark(results, JOB_KEYS.tm30Escalations, tm30.ok, tm30.summary);

  const ical = await runIcalSyncJob(db);
  mark(results, JOB_KEYS.icalSync, ical.ok, ical.summary);

  return results;
}

/**
 * Nightly slot: verification, retention, rollup, guest messages, stale
 * service orders. Scheduled at `/api/cron/run-all`.
 *
 * Hold expiry stays here so a missed daytime tick still clears abandoned
 * checkouts before the next night. iCal does **not** — a slow feed would
 * eat the Hobby time budget and the compliance jobs below would never start.
 * OTA sync belongs to the daytime slot only.
 */
export async function runNightlyJobs(db: PrismaClient): Promise<JobDispatchResult> {
  const results: JobDispatchResult = {};

  const booking = await runBookingLifecycleJob(db);
  mark(results, JOB_KEYS.bookingLifecycle, booking.ok, booking.summary);

  const verification = await runVerificationDeadlinesJob(db);
  mark(results, JOB_KEYS.verificationDeadlines, verification.ok, verification.summary);

  const retention = await runRetentionJob(db);
  mark(results, JOB_KEYS.retention, retention.ok, retention.summary);

  const rollup = await runMetricsRollupJob(db);
  mark(results, JOB_KEYS.metricsRollup, rollup.ok, rollup.summary);

  const guest = await runGuestLifecycleJob(db);
  mark(results, JOB_KEYS.guestLifecycle, guest.ok, guest.summary);

  const orders = await runServiceOrderExpiryJob(db);
  mark(results, JOB_KEYS.serviceOrderExpiry, orders.ok, orders.summary);

  const tm30 = await runTm30EscalationsJob(db);
  mark(results, JOB_KEYS.tm30Escalations, tm30.ok, tm30.summary);

  return results;
}

export function dispatchFailed(results: JobDispatchResult): boolean {
  return Object.values(results).includes('failed');
}
