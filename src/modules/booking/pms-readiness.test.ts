import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(undefined) }));

import { checkInBooking, checkOutBooking } from './booking.service';

describe('PMS readiness lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks check-in while required turnover work is open', async () => {
    const booking = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'booking-next',
        unitId: 'unit-a',
        projectId: 'project-a',
        guestIdentityId: 'guest-a',
        status: 'confirmed',
      }),
      update: vi.fn(),
    };
    const operationalTask = {
      findMany: vi.fn().mockResolvedValue([{
          id: 'task-clean',
          taskType: 'turnover_cleaning',
          status: 'in_progress',
          dueAt: new Date('2026-10-02T10:00:00Z'),
        }]),
    };
    const db: any = {
      booking,
      operationalTask,
      $transaction: (fn: any) => fn({ booking, operationalTask }),
    };

    await expect(
      checkInBooking(db, 'booking-next', new Date('2026-10-02T12:00:00Z'))
    ).rejects.toMatchObject({ code: 'UNIT_NOT_READY' });
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('creates cleaning and inspection tasks on checkout', async () => {
    const checkedOut = {
      id: 'booking-a',
      unitId: 'unit-a',
      projectId: 'project-a',
      guestIdentityId: 'guest-a',
      status: 'checked_out',
      checkedOutAt: new Date('2026-10-02T10:00:00Z'),
      endDate: new Date('2026-10-02T00:00:00Z'),
    };
    const booking = {
      findUnique: vi.fn().mockResolvedValue({ ...checkedOut, status: 'checked_in' }),
      update: vi.fn().mockResolvedValue(checkedOut),
    };
    const operationalTask = {
      upsert: vi.fn().mockImplementation(({ create }: any) => Promise.resolve(create)),
    };
    const db: any = {
      booking,
      operationalTask,
      $transaction: (fn: any) => fn({ booking, operationalTask }),
    };

    await checkOutBooking(db, 'booking-a', checkedOut.checkedOutAt);

    expect(operationalTask.upsert).toHaveBeenCalledTimes(2);
    const taskTypes = operationalTask.upsert.mock.calls
      .map((call: any[]) => call[0].create.taskType)
      .sort();
    expect(taskTypes).toEqual(['turnover_cleaning', 'turnover_inspection']);
  });
});
