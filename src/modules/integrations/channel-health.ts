import type { PrismaClient } from '@prisma/client';

export type ChannelHealthState =
  | 'healthy'
  | 'delayed'
  | 'error'
  | 'connected'
  | 'manual_only';

export interface ChannelHealthRow {
  channel: string;
  state: ChannelHealthState;
  availability: 'push' | 'ical' | 'manual';
  rates: 'push' | 'manual';
  restrictions: 'push' | 'manual';
  lastSyncAt: Date | null;
  error: string | null;
}

export interface UnitChannelHealth {
  state: ChannelHealthState;
  rows: ChannelHealthRow[];
}

const ICAL_KEY_BY_CHANNEL: Record<string, 'ical_airbnb' | 'ical_booking' | 'ical_agoda'> = {
  airbnb: 'ical_airbnb',
  booking: 'ical_booking',
  booking_com: 'ical_booking',
  agoda: 'ical_agoda',
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasErrors(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export async function getChannelHealthForUnits(
  db: PrismaClient,
  unitIds: string[],
  now: Date = new Date()
): Promise<Record<string, UnitChannelHealth>> {
  const result: Record<string, UnitChannelHealth> = Object.fromEntries(
    unitIds.map((id) => [id, { state: 'manual_only', rows: [] }])
  );
  if (!unitIds.length) return result;

  const [offerings, accounts] = await Promise.all([
    db.commercialOffering.findMany({
      where: {
        unitId: { in: unitIds },
        offeringType: { in: ['short_term_stay', 'short_stay'] },
      },
      select: {
        unitId: true,
        channelMappings: {
          select: {
            channel: true,
            syncState: true,
            lastSyncAt: true,
            syncErrors: true,
            channelOverrides: true,
          },
        },
      },
    }),
    db.integrationAccount.findMany({
      where: {
        unitId: { in: unitIds },
        integrationKey: { in: ['ical_airbnb', 'ical_booking', 'ical_agoda'] },
      },
      select: {
        unitId: true,
        integrationKey: true,
        status: true,
        lastSyncAt: true,
        lastError: true,
      },
    }),
  ]);

  const accountByUnitAndKey = new Map(
    accounts
      .filter((account) => account.unitId)
      .map((account) => [`${account.unitId}:${account.integrationKey}`, account] as const)
  );

  for (const offering of offerings) {
    if (!offering.unitId) continue;
    const unit = result[offering.unitId] ?? { state: 'manual_only' as const, rows: [] };

    for (const mapping of offering.channelMappings) {
      const overrides = asObject(mapping.channelOverrides);
      const ari = asObject(overrides.ariCapabilities);
      const availabilityPush = ari.availability === true;
      const ratesPush = ari.rates === true;
      const restrictionsPush = ari.restrictions === true;
      const fullAri = availabilityPush && ratesPush && restrictionsPush;
      const partialAri = availabilityPush || ratesPush || restrictionsPush;

      const integrationKey = ICAL_KEY_BY_CHANNEL[mapping.channel];
      const account = integrationKey
        ? accountByUnitAndKey.get(`${offering.unitId}:${integrationKey}`)
        : undefined;
      const icalConnected = Boolean(account && account.status === 'active');
      const latestSync = [mapping.lastSyncAt, account?.lastSyncAt ?? null]
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const stale = latestSync
        ? now.getTime() - latestSync.getTime() > 2 * 60 * 60 * 1000
        : true;
      const error =
        mapping.syncState === 'error' ||
        hasErrors(mapping.syncErrors) ||
        account?.status === 'error';
      let state: ChannelHealthState;
      if (error) state = 'error';
      else if (fullAri) state = stale ? 'delayed' : 'healthy';
      else if (partialAri) state = 'connected';
      else state = 'manual_only';

      const row: ChannelHealthRow = {
        channel: mapping.channel,
        state,
        availability: availabilityPush ? 'push' : icalConnected ? 'ical' : 'manual',
        rates: ratesPush ? 'push' : 'manual',
        restrictions: restrictionsPush ? 'push' : 'manual',
        lastSyncAt: latestSync,
        error: account?.lastError ?? (error ? 'Channel synchronization error' : null),
      };
      unit.rows.push(row);
    }

    const priority: ChannelHealthState[] = ['error', 'delayed', 'manual_only', 'connected', 'healthy'];
    unit.state = unit.rows.length
      ? unit.rows.map((row) => row.state).sort(
          (a, b) => priority.indexOf(a) - priority.indexOf(b)
        )[0]
      : 'manual_only';
    result[offering.unitId] = unit;
  }

  return result;
}
