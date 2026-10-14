import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, resetDb, createIdentity } from '@/test/util';

vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';
import { resetRateLimit } from '@/app/libs/rateLimit';

const request = (email: string, password: string, ip: string) => new NextRequest('http://localhost/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({ email, password }),
});

describe('POST /api/auth/login — rate limits', () => {
  const ip = '203.0.113.9';
  beforeEach(async () => {
    await resetDb();
    await resetRateLimit(`login:ip:${ip}`);
  });

  it('many successful sign-ins from one shared address (office, hotel desk) are never throttled', async () => {
    const hashed = await bcrypt.hash('Passw0rd!x', 4);
    const users = await Promise.all(Array.from({ length: 8 }, async (_, i) => {
      const user = await createIdentity({ email: `shared-${i}@example.test` });
      return db.identity.update({ where: { id: user.id }, data: { hashedPassword: hashed } });
    }));
    for (const user of users) {
      expect((await POST(request(user.email!, 'Passw0rd!x', ip))).status).toBe(200);
    }
  });

  it('still brakes a flood of wrong passwords from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 24; i++) statuses.push((await POST(request(`nobody-${i}@example.test`, 'wrong', ip))).status);
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(20).every((status) => status === 429)).toBe(true);
  });

  it('locks one account after 5 wrong passwords', async () => {
    const created = await createIdentity({ email: 'victim@example.test' });
    const user = await db.identity.update({ where: { id: created.id }, data: { hashedPassword: await bcrypt.hash('Passw0rd!x', 4) } });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await POST(request(user.email!, 'wrong', `198.51.100.${i}`))).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
  });
});
