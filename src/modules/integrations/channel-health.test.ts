import { describe, expect, it, vi } from 'vitest';
import { getChannelHealthForUnits } from './channel-health';

describe('channel health projection', () => {
  it('reports iCal as manual-only ARI while showing availability import', async () => {
    const db: any = {
      commercialOffering: {
        findMany: vi.fn().mockResolvedValue([{
          unitId: 'unit-a',
          channelMappings: [{
            channel: 'airbnb',
            syncState: 'synced',
            lastSyncAt: new Date('2026-10-02T09:30:00Z'),
            syncErrors: [],
            channelOverrides: {},
          }],
        }]),
      },
      integrationAccount: {
        findMany: vi.fn().mockResolvedValue([{
          unitId: 'unit-a',
          integrationKey: 'ical_airbnb',
          status: 'active',
          lastSyncAt: new Date('2026-10-02T09:45:00Z'),
          lastError: null,
        }]),
      },
    };

    const health = await getChannelHealthForUnits(
      db,
      ['unit-a'],
      new Date('2026-10-02T10:00:00Z')
    );

    expect(health['unit-a'].state).toBe('manual_only');
    expect(health['unit-a'].rows[0]).toMatchObject({
      availability: 'ical',
      rates: 'manual',
      restrictions: 'manual',
      state: 'manual_only',
    });
  });

  it('marks fully-capable recent ARI as healthy', async () => {
    const db: any = {
      commercialOffering: {
        findMany: vi.fn().mockResolvedValue([{
          unitId: 'unit-a',
          channelMappings: [{
            channel: 'booking_com',
            syncState: 'ari_push',
            lastSyncAt: new Date('2026-10-02T09:50:00Z'),
            syncErrors: [],
            channelOverrides: {
              ariCapabilities: { availability: true, rates: true, restrictions: true },
            },
          }],
        }]),
      },
      integrationAccount: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const health = await getChannelHealthForUnits(
      db,
      ['unit-a'],
      new Date('2026-10-02T10:00:00Z')
    );

    expect(health['unit-a'].state).toBe('healthy');
    expect(health['unit-a'].rows[0]).toMatchObject({
      availability: 'push',
      rates: 'push',
      restrictions: 'push',
    });
  });

  it('surfaces channel errors ahead of nominal sync state', async () => {
    const db: any = {
      commercialOffering: {
        findMany: vi.fn().mockResolvedValue([{
          unitId: 'unit-a',
          channelMappings: [{
            channel: 'agoda',
            syncState: 'error',
            lastSyncAt: null,
            syncErrors: [{ message: 'rejected' }],
            channelOverrides: {
              ariCapabilities: { availability: true, rates: true, restrictions: true },
            },
          }],
        }]),
      },
      integrationAccount: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const health = await getChannelHealthForUnits(db, ['unit-a']);
    expect(health['unit-a'].state).toBe('error');
  });
});
