import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
const config = vi.hoisted(() => vi.fn());
vi.mock('@/modules/config', () => ({ getConfig: config }));
import { getBookingTimingConfig } from './timing-config';

describe('fresh scoped booking deadlines', () => {
  const db = {} as PrismaClient;
  const scope = { projectId: 'project-a', unitId: 'unit-a' };
  beforeEach(() => config.mockReset());
  it('uses documented defaults only when the configuration is absent', async () => {
    config.mockResolvedValue(undefined);
    expect(await getBookingTimingConfig(db, scope)).toEqual({ holdMinutes: 30, manualHoldMinutes: 1440, requestHours: 24 });
  });
  it('reads every value freshly with the same unit/project scope', async () => {
    const values: Record<string, number> = { 'booking.hold_minutes': 17,
      'booking.manual_payment_hold_hours': 4, 'booking.request_hours': 6 };
    config.mockImplementation(async (_db, key) => values[key]);
    expect(await getBookingTimingConfig(db, scope)).toEqual({ holdMinutes: 17, manualHoldMinutes: 240, requestHours: 6 });
    for (const call of config.mock.calls) expect(call[2]).toEqual({ ...scope, fresh: true });
  });
  it('refuses an invalid configured window rather than silently substituting a default', async () => {
    config.mockResolvedValue(0);
    await expect(getBookingTimingConfig(db, scope)).rejects.toThrow(/positive whole units/);
  });
});
