import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from '@/test/util';
import { checkRateLimit, rateLimitBucketKey, refundRateLimit, resetRateLimit } from './rateLimit';

const stored = (key: string) => ({ key: rateLimitBucketKey(key) });

const cfg = { maxAttempts: 3, windowMs: 60_000, backoffMs: 1000 };

describe('shared rate limiter', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('allows up to the budget, then blocks with a back-off that grows', async () => {
    for (let i = 0; i < 3; i++) expect((await checkRateLimit('t:a', cfg)).allowed).toBe(true);
    const first = await checkRateLimit('t:a', cfg);
    const second = await checkRateLimit('t:a', cfg);
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs!).toBeGreaterThan(first.retryAfterMs!);
  });

  it('keeps keys independent and stores the count in the database, not in memory', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit('t:one', cfg);
    expect((await checkRateLimit('t:two', cfg)).allowed).toBe(true);
    const row = await db.rateLimitBucket.findUniqueOrThrow({ where: stored('t:one') });
    expect(row.attempts).toBe(3);
  });

  it('starts a fresh window once the old one has expired', async () => {
    for (let i = 0; i < 4; i++) await checkRateLimit('t:w', cfg);
    await db.rateLimitBucket.update({ where: stored('t:w'), data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await checkRateLimit('t:w', cfg)).allowed).toBe(true);
    expect((await db.rateLimitBucket.findUniqueOrThrow({ where: stored('t:w') })).attempts).toBe(1);
  });

  it('reset clears the key and refund gives one attempt back without going below zero', async () => {
    await checkRateLimit('t:r', cfg);
    await checkRateLimit('t:r', cfg);
    await refundRateLimit('t:r');
    expect((await db.rateLimitBucket.findUniqueOrThrow({ where: stored('t:r') })).attempts).toBe(1);
    await refundRateLimit('t:r');
    await refundRateLimit('t:r');
    expect((await db.rateLimitBucket.findUniqueOrThrow({ where: stored('t:r') })).attempts).toBe(0);
    await resetRateLimit('t:r');
    expect(await db.rateLimitBucket.count({ where: stored('t:r') })).toBe(0);
  });

  it('stores only a fixed-length hash, never the address or e-mail, and survives an oversized key', async () => {
    const email = 'login:acct:' + 'a'.repeat(400) + '@example.com';
    expect((await checkRateLimit(email, cfg)).allowed).toBe(true);
    const rows = await db.rateLimitBucket.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain('example.com');
  });

  it('counts concurrent attempts exactly (the upsert is atomic)', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => checkRateLimit('t:c', cfg)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });
});
