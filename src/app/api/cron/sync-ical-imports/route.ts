import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { IntegrationKey, IntegrationStatus } from '@prisma/client';

/**
 * Cron job to sync iCal imports from OTA sources.
 * Called periodically (e.g., hourly) to fetch updates from Airbnb, Booking.com, Agoda.
 *
 * For loop one, this is a stub that:
 * 1. Identifies active iCal integrations
 * 2. Logs that they need to be synced (adapter stubs per Q-19)
 * 3. Records sync attempt for health monitoring
 *
 * Real sync logic (fetch from OTA APIs, parse iCal, import) comes after Q-19 is answered.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Find all active iCal integration accounts
    const integrations = await prisma.integrationAccount.findMany({
      where: {
        integrationKey: {
          in: [
            IntegrationKey.ical_airbnb,
            IntegrationKey.ical_booking,
            IntegrationKey.ical_agoda,
          ],
        },
        status: IntegrationStatus.active,
      },
      include: {
        unit: true,
        project: true,
      },
    });

    const results = {
      totalIntegrations: integrations.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const integration of integrations) {
      try {
        // Stub: In production, this would:
        // 1. Fetch the OTA iCal URL (from config.ical_url)
        // 2. Parse the iCal events
        // 3. Call importICalEvents() to detect conflicts and create BlockedDates
        // 4. Call createConflictNotifications() for any conflicts
        //
        // For now, just record the sync attempt.

        await prisma.integrationAccount.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            status: IntegrationStatus.active,
            lastError: null,
          },
        });

        results.synced++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.failed++;
        results.errors.push(
          `${integration.integrationKey} (unit: ${integration.unit?.id}): ${errorMsg}`
        );

        // Record error in integration account
        await prisma.integrationAccount.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            status: IntegrationStatus.error,
            lastError: errorMsg,
          },
        });
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[iCal sync cron] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync iCal imports',
      },
      { status: 500 }
    );
  }
}
