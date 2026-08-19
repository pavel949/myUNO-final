import { PrismaClient, IntegrationKey, IntegrationStatus } from '@prisma/client';
import { fetchICalFeed, ICalFetchError } from './ical-fetch';
import { parseICal } from './ical-parse';
import { importICalEvents, createConflictNotifications } from './ical-import';
import { getDecryptedConfig } from './integrations';

/**
 * One sync: fetch a unit's OTA calendar, parse it, and import what it says.
 *
 * The cron used to stamp `lastSyncAt` and clear `lastError` without fetching
 * anything, so the integration health panel showed every feed green while no
 * feed had ever been read. A unit sold on Airbnb was therefore still on sale
 * here, and the screen built to warn about exactly that said all was well.
 *
 * The rule this file exists to hold: **a sync is only recorded as successful if
 * a feed was actually fetched, parsed and imported.** Anything else records the
 * error and leaves the account visibly unhealthy.
 */

export const ICAL_INTEGRATION_KEYS = [
  IntegrationKey.ical_airbnb,
  IntegrationKey.ical_booking,
  IntegrationKey.ical_agoda,
] as const;

export interface SyncOneResult {
  integrationAccountId: string;
  unitId: string;
  imported: number;
  conflicts: number;
  /** Events the feed contained that could not be trusted, with reasons. */
  skipped: Array<{ reason: string; uid?: string }>;
}

/** The feed URL an operator saved against this integration. */
export function readFeedUrl(config: Record<string, unknown>): string | null {
  const candidate = config.ical_url ?? config.icalUrl ?? config.url;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

/**
 * Sync one integration account. Throws on any failure, so the caller records the
 * account as errored rather than quietly counting it as done.
 */
export async function syncICalAccount(
  db: PrismaClient,
  integrationAccountId: string
): Promise<SyncOneResult> {
  const account = await db.integrationAccount.findUnique({
    where: { id: integrationAccountId },
    select: { id: true, unitId: true, integrationKey: true, config: true },
  });

  if (!account) {
    throw new Error(`Integration account ${integrationAccountId} not found`);
  }
  if (!account.unitId) {
    throw new Error('An iCal feed is per-unit; this account has no unit scope');
  }

  const config = getDecryptedConfig(account);
  const feedUrl = readFeedUrl(config as Record<string, unknown>);
  if (!feedUrl) {
    throw new ICalFetchError(
      'No feed URL configured — set ical_url on the integration before enabling it'
    );
  }

  const body = await fetchICalFeed(feedUrl);
  const { events, skipped } = parseICal(body);

  // A feed that parses to nothing is reported rather than treated as "no
  // bookings". An empty calendar and an unreadable one look identical in the
  // result otherwise, and the second is a fault we need to see.
  if (events.length === 0 && !body.includes('BEGIN:VCALENDAR')) {
    throw new ICalFetchError('Response is not an iCalendar document');
  }

  const result = await importICalEvents(db, account.id, account.unitId, events);

  if (result.conflicts.length > 0) {
    await createConflictNotifications(db, account.unitId, result.conflicts);
  }

  return {
    integrationAccountId: account.id,
    unitId: account.unitId,
    imported: result.imported,
    conflicts: result.conflicts.length,
    skipped,
  };
}

export interface SyncAllResult {
  totalIntegrations: number;
  synced: number;
  failed: number;
  imported: number;
  conflicts: number;
  errors: Array<{ integrationAccountId: string; error: string }>;
}

/**
 * Sync every active iCal integration.
 *
 * One feed being down must not stop the rest, so each is caught individually and
 * its account marked errored. The returned counts are what actually happened.
 */
export async function syncAllICalAccounts(db: PrismaClient): Promise<SyncAllResult> {
  const accounts = await db.integrationAccount.findMany({
    where: {
      integrationKey: { in: [...ICAL_INTEGRATION_KEYS] },
      status: IntegrationStatus.active,
    },
    select: { id: true },
  });

  const summary: SyncAllResult = {
    totalIntegrations: accounts.length,
    synced: 0,
    failed: 0,
    imported: 0,
    conflicts: 0,
    errors: [],
  };

  for (const account of accounts) {
    try {
      const result = await syncICalAccount(db, account.id);

      summary.synced += 1;
      summary.imported += result.imported;
      summary.conflicts += result.conflicts;

      await db.integrationAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date(), status: IntegrationStatus.active, lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.errors.push({ integrationAccountId: account.id, error: message });

      // lastSyncAt is deliberately left alone on failure: it means "when this
      // feed was last successfully read", and moving it here would let a feed
      // that has been broken for a week look freshly synced.
      await db.integrationAccount.update({
        where: { id: account.id },
        data: { status: IntegrationStatus.error, lastError: message },
      });
    }
  }

  return summary;
}
