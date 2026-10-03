import { describe, expect, it, vi } from 'vitest';
import { getUnitReadinessMap, transitionOperationalTask } from './operational-task.service';

describe('operational readiness tasks', () => {
  it('derives unit readiness from open canonical tasks', async () => {
    const db: any = {
      operationalTask: {
        findMany: vi.fn().mockResolvedValue([
          { unitId: 'unit-a', taskType: 'turnover_cleaning', status: 'assigned' },
          { unitId: 'unit-b', taskType: 'turnover_inspection', status: 'in_progress' },
        ]),
      },
    };
    const result = await getUnitReadinessMap(db, ['unit-a', 'unit-b', 'unit-c']);
    expect(result['unit-a']).toEqual({ state: 'needs_cleaning', openTaskCount: 1 });
    expect(result['unit-b']).toEqual({ state: 'in_progress', openTaskCount: 1 });
    expect(result['unit-c']).toEqual({ state: 'ready', openTaskCount: 0 });
  });

  it('enforces the readiness task state machine', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'task-a', status: 'assigned' });
    const tx = {
      operationalTask: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'task-a', status: 'planned', startedAt: null,
        }),
        update,
      },
    };
    const db: any = { $transaction: (fn: any) => fn(tx) };

    await transitionOperationalTask(db, 'task-a', 'assigned', {
      assignedIdentityId: 'staff-a',
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'assigned',
        assignedIdentityId: 'staff-a',
      }),
    }));

    tx.operationalTask.findUnique.mockResolvedValue({
      id: 'task-a', status: 'ready', startedAt: new Date(),
    });
    await expect(
      transitionOperationalTask(db, 'task-a', 'in_progress')
    ).rejects.toThrow(/Invalid operational task transition/);
  });
});
