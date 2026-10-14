import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { advanceSessionGeneration } from './session-generation';

describe('atomic session generation rotation', () => {
  beforeEach(async () => { await resetDb(); });

  it('advances beyond a future stored generation instead of moving it backwards', async () => {
    const identity = await createIdentity();
    const future = new Date(Date.now() + 60_000);
    await db.identity.update({ where: { id: identity.id }, data: { sessionsValidFrom: future } });
    const first = await advanceSessionGeneration(db, identity.id);
    const second = await advanceSessionGeneration(db, identity.id);
    expect(first.getTime()).toBe(future.getTime() + 1);
    expect(second.getTime()).toBe(first.getTime() + 1);
  });

  it('assigns distinct generations to concurrent revocations and stores the maximum', async () => {
    const identity = await createIdentity();
    const values = await Promise.all(Array.from({ length: 6 }, () => advanceSessionGeneration(db, identity.id)));
    const stamps = values.map((value) => value.getTime());
    expect(new Set(stamps).size).toBe(6);
    const current = await db.identity.findUniqueOrThrow({ where: { id: identity.id } });
    expect(current.sessionsValidFrom!.getTime()).toBe(Math.max(...stamps));
  });
});
