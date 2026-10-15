import { describe, expect, it, vi } from 'vitest';
import type { BlockedDate, PrismaClient } from '@prisma/client';
import { createManualBlock, type CreateManualBlockInput } from './availability.service';

vi.mock('@/modules/config', () => ({ getConfig: vi.fn() }));

const input: CreateManualBlockInput = {
  unitId: 'unit-a',
  startDate: new Date('2026-12-10'),
  endDate: new Date('2026-12-15'),
  reason: 'maintenance',
  note: 'Repair pool pump',
  createdByIdentityId: 'staff-a',
};

function block(overrides: Partial<BlockedDate> = {}): BlockedDate {
  return {
    ...input,
    note: input.note!,
    id: 'existing-block',
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    externalRef: null,
    propertyDealId: null,
    ...overrides,
  };
}

// Bounded query/ordering contract double; PostgreSQL serialization is covered
// separately by manual-block-retries.integration.test.ts, not simulated here.
function client(existing: BlockedDate | null = null, conflict = false) {
  const calls: string[] = [];
  const rows = existing ? [existing] : [];
  const tx = {
    $executeRaw: vi.fn(async () => { calls.push('lock'); }),
    booking: { findFirst: vi.fn(async () => {
      calls.push('booking');
      return conflict ? { id: 'booking-a' } : null;
    }) },
    blockedDate: {
      findFirst: vi.fn(async ({ where }: { where: Partial<BlockedDate> }) => {
        calls.push('lookup');
        return rows.find((row) => Object.entries(where).every(([key, value]) => {
          const actual = row[key as keyof BlockedDate];
          return value instanceof Date && actual instanceof Date
            ? value.getTime() === actual.getTime()
            : actual === value;
        })) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<BlockedDate> }) => {
        calls.push('create');
        const created = block({ ...data, id: `created-${rows.length}` });
        rows.push(created);
        return created;
      }),
    },
  };
  const db = {
    unit: { findUnique: vi.fn(async () => ({ id: input.unitId })) },
    $transaction: vi.fn(async (fn: (transaction: typeof tx) => Promise<BlockedDate>) => fn(tx)),
  };
  return { db: db as unknown as PrismaClient, tx, calls, rows };
}

describe('manual block retry contract', () => {
  it('reuses the exact manual row only after the unit lock and booking check', async () => {
    const existing = block();
    const f = client(existing);
    expect(await createManualBlock(f.db, input)).toEqual(existing);
    expect(f.calls).toEqual(['lock', 'booking', 'lookup']);
    expect(f.tx.$executeRaw).toHaveBeenCalledWith(expect.anything(), input.unitId);
    expect(f.tx.blockedDate.findFirst).toHaveBeenCalledWith({
      where: { ...input, externalRef: null, propertyDealId: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(f.tx.blockedDate.create).not.toHaveBeenCalled();
  });

  it('creates once for a serial retry and returns the same identity', async () => {
    const f = client();
    const first = await createManualBlock(f.db, input);
    const retry = await createManualBlock(f.db, { ...input });
    expect(retry).toEqual(first);
    expect(f.rows).toHaveLength(1);
    expect(f.tx.blockedDate.create).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, ''])('normalizes the absent note %s to the existing null', async (note) => {
    const f = client(block({ note: null }));
    expect((await createManualBlock(f.db, { ...input, note })).id).toBe('existing-block');
    expect(f.tx.blockedDate.create).not.toHaveBeenCalled();
  });

  it('uses calendar dates for equality, booking conflicts, and persistence', async () => {
    const f = client();
    const dated = {
      ...input,
      startDate: new Date('2026-12-10T16:45:00Z'),
      endDate: new Date('2026-12-15T09:30:00Z'),
    };
    const first = await createManualBlock(f.db, dated);
    expect(await createManualBlock(f.db, input)).toEqual(first);
    expect(f.tx.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ startDate: { lt: input.endDate }, endDate: { gt: input.startDate } }),
    }));
    expect(first.startDate).toEqual(input.startDate);
    expect(first.endDate).toEqual(input.endDate);
  });

  it.each([
    { unitId: 'unit-b' },
    { createdByIdentityId: 'staff-b' },
    { reason: 'owner_hold' as const },
    { reason: 'ota_import' as const },
    { note: 'Different repair' },
    { startDate: new Date('2026-12-09') },
    { endDate: new Date('2026-12-16') },
    { externalRef: 'ical:event-a' },
    { propertyDealId: 'signed-lease-a' },
  ])('does not reuse a different scope, payload, or source: %j', async (difference) => {
    const existing = block(difference);
    const f = client(existing);
    expect((await createManualBlock(f.db, input)).id).not.toBe(existing.id);
    expect(f.rows).toHaveLength(2);
    expect(f.rows[0]).toEqual(existing);
  });

  it('still rejects an active booking even when an exact block exists', async () => {
    const f = client(block(), true);
    await expect(createManualBlock(f.db, input)).rejects.toMatchObject({
      code: 'BOOKING_CONFLICT', bookingId: 'booking-a',
    });
    expect(f.calls).toEqual(['lock', 'booking']);
    expect(f.tx.blockedDate.findFirst).not.toHaveBeenCalled();
    expect(f.tx.blockedDate.create).not.toHaveBeenCalled();
  });

  it('rejects an empty calendar range before starting a transaction', async () => {
    const f = client();
    await expect(createManualBlock(f.db, {
      ...input,
      startDate: new Date('2026-12-10T01:00:00Z'),
      endDate: new Date('2026-12-10T02:00:00Z'),
    })).rejects.toThrow('endDate must be after startDate');
    expect(f.calls).toEqual([]);
  });
});
