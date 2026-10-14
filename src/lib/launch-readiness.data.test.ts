import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const { getSchedulerHealthMock, jobsNeedingAttentionMock, getConfigMock } = vi.hoisted(() => ({
  getSchedulerHealthMock: vi.fn(),
  jobsNeedingAttentionMock: vi.fn(),
  getConfigMock: vi.fn(),
}));

vi.mock('@/jobs', () => ({
  getSchedulerHealth: getSchedulerHealthMock,
  jobsNeedingAttention: jobsNeedingAttentionMock,
}));

vi.mock('@/modules/config', () => ({
  getConfig: getConfigMock,
}));

import { evaluateDataReadiness } from './launch-readiness';

function item(items: Awaited<ReturnType<typeof evaluateDataReadiness>>, id: string) {
  return items.find((row) => row.id === id)!;
}

describe('launch readiness (catalogue gates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSchedulerHealthMock.mockResolvedValue([{ cadence: 'frequent', lastFinishedAt: new Date() }]);
    jobsNeedingAttentionMock.mockReturnValue([]);
    getConfigMock.mockResolvedValue('configured');
  });

  it('blocks launch when there are no published units', async () => {
    const db = {
      unit: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaClient;

    const items = await evaluateDataReadiness(db);

    expect(item(items, 'live_units')).toMatchObject({ state: 'action', blocking: true, detail: '0' });
  });

  it('blocks launch when any published unit lacks permitted-use confirmation', async () => {
    const db = {
      unit: {
        count: vi.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(where.permittedUseConfirmedAt === null ? 1 : 2)
        ),
      },
    } as unknown as PrismaClient;

    const items = await evaluateDataReadiness(db);

    expect(item(items, 'live_units')).toMatchObject({ state: 'ok', blocking: true, detail: '2' });
    expect(item(items, 'permitted_use')).toMatchObject({ state: 'action', blocking: true, detail: '1' });
  });

  it('reports a published catalogue and a failed scheduler independently', async () => {
    const db = {
      unit: {
        count: vi.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(where.permittedUseConfirmedAt === null ? 0 : 1)
        ),
      },
    } as unknown as PrismaClient;
    const failedJob = { cadence: 'frequent', status: 'failed', lastFinishedAt: new Date() };
    getSchedulerHealthMock.mockResolvedValue([failedJob]);
    jobsNeedingAttentionMock.mockReturnValue([failedJob]);

    const items = await evaluateDataReadiness(db);

    expect(item(items, 'live_units')).toMatchObject({ state: 'ok', blocking: true, detail: '1' });
    expect(item(items, 'permitted_use')).toMatchObject({ state: 'ok', blocking: true, detail: '0' });
    expect(item(items, 'scheduler_running')).toMatchObject({ state: 'action', blocking: true });
  });
});
