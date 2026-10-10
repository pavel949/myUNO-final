import { describe, it, expect, vi } from 'vitest';
import { validateSleepingSpace } from './sleeping-space-input';
import { saveSleepingSpace, sleepingSpaceRequestKey, SleepingSpaceRequestConflict } from './sleeping-space-write';
const body = { spaceType: 'bedroom', name: ' Bedroom 1 ', sortOrder: 0,
  beds: [{ bedType: 'double', count: 1 }], requestId: 'source-room-key-01' };
function fakeDb() {
  const rows = new Map<string, any>();
  let sequence = 0;
  const create = vi.fn(async ({ data }: any) => {
    const id = data.id || `legacy-${++sequence}`;
    // Model the database unique key, including two concurrent contenders.
    if (rows.has(id)) throw Object.assign(new Error('Unique violation'), { code: 'P2002' });
    const row = { ...data, id, beds: data.beds.create.map((bed: any, index: number) => ({ ...bed, id: `bed-${index}` })) };
    rows.set(id, row);
    return row;
  });
  const findUnique = vi.fn(async ({ where }: any) => rows.get(where.id) || null);
  return { db: { sleepingSpace: { create, findUnique } } as any, rows, create, findUnique };
}
describe('sleeping-space validation and replay safety', () => {
  it('preserves generic double without guessing a size', () => {
    expect(validateSleepingSpace(body)).toMatchObject({ name: 'Bedroom 1', beds: [{ bedType: 'double', count: 1 }] });
  });
  it.each([0, -1, 1.5, NaN, Infinity, null, true, '', 2147483648])('rejects invalid count %s', count => {
    expect(() => validateSleepingSpace({ ...body, beds: [{ bedType: 'double', count }] })).toThrow();
  });
  it.each([{ beds: [] }, { beds: [{ bedType: 'unknown', count: 1 }] }, { beds: [{ bedType: 'single', count: 1 }, { bedType: 'single', count: 2 }] }])('rejects invalid bed sets $beds', ({ beds }) => {
    expect(() => validateSleepingSpace({ ...body, beds })).toThrow();
  });
  it('retains defaults for legacy callers without a request ID', async () => {
    const { db, rows } = fakeDb();
    const result = await saveSleepingSpace(db, 'G1', { beds: [{ bedType: 'king', count: '1' }] });
    expect(result.space).toMatchObject({ spaceType: 'bedroom', name: null, sortOrder: 0 });
    expect(result.created).toBe(true);
    expect(rows.size).toBe(1);
  });
  it('supports sequential replay without appending rooms or beds', async () => {
    const { db, rows } = fakeDb();
    const first = await saveSleepingSpace(db, 'G1', body);
    const second = await saveSleepingSpace(db, 'G1', body);
    expect(first.created).toBe(true); expect(second.created).toBe(false);
    expect(second.space.id).toBe(first.space.id); expect(rows.size).toBe(1);
  });
  it('arbitrates concurrent identical replays with the unique key', async () => {
    const { db, rows } = fakeDb();
    const results = await Promise.all([saveSleepingSpace(db, 'G1', body), saveSleepingSpace(db, 'G1', body)]);
    expect(results.filter(r => r.created)).toHaveLength(1); expect(rows.size).toBe(1);
  });
  it('rejects changed payload on sequential key reuse', async () => {
    const { db, rows } = fakeDb(); await saveSleepingSpace(db, 'G1', body);
    await expect(saveSleepingSpace(db, 'G1', { ...body, beds: [{ bedType: 'single', count: 2 }] })).rejects.toBeInstanceOf(SleepingSpaceRequestConflict);
    expect(rows.size).toBe(1); expect([...rows.values()][0].beds[0].bedType).toBe('double');
  });
  it('rejects conflicting concurrent payloads without overwriting', async () => {
    const { db, rows } = fakeDb();
    const results = await Promise.allSettled([saveSleepingSpace(db, 'G1', body), saveSleepingSpace(db, 'G1', { ...body, name: 'Other room' })]);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1); expect(rows.size).toBe(1);
  });
  it('separates keys by unit and permits separate identical rooms', async () => {
    const { db, rows } = fakeDb();
    await saveSleepingSpace(db, 'G1', body);
    await saveSleepingSpace(db, 'G2', body);
    await saveSleepingSpace(db, 'G1', { ...body, requestId: 'source-room-key-02' });
    expect(rows.size).toBe(3);
    expect(sleepingSpaceRequestKey('G1', body.requestId)).not.toBe(sleepingSpaceRequestKey('G2', body.requestId));
  });
  it('compares canonical bed order on replay', async () => {
    const { db, rows } = fakeDb(); const beds = [{ bedType: 'double', count: 1 }, { bedType: 'single', count: 2 }];
    await saveSleepingSpace(db, 'G1', { ...body, beds });
    const replay = await saveSleepingSpace(db, 'G1', { ...body, beds: [...beds].reverse() });
    expect(replay.created).toBe(false); expect(rows.size).toBe(1);
  });
  it('does not mask foreign-key or other errors', async () => {
    const { db, create } = fakeDb(); const error = Object.assign(new Error('Missing unit'), { code: 'P2003' });
    create.mockRejectedValue(error); await expect(saveSleepingSpace(db, 'G1', body)).rejects.toBe(error);
  });
  it('does not claim successful replay when no winner can be read', async () => {
    const { db, create } = fakeDb(); const error = Object.assign(new Error('Other unique violation'), { code: 'P2002' });
    create.mockRejectedValue(error); await expect(saveSleepingSpace(db, 'G1', body)).rejects.toBe(error);
  });
  it('rejects invalid space, order and idempotency keys before writes', async () => {
    const { db, create } = fakeDb();
    for (const delta of [{ spaceType: 'unknown' }, { sortOrder: -1 }, { requestId: '' }, { name: 1 }]) {
      await expect(saveSleepingSpace(db, 'G1', { ...body, ...delta })).rejects.toThrow();
    }
    expect(create).not.toHaveBeenCalled();
  });
});
