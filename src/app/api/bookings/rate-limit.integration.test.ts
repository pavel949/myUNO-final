import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb, createIdentity } from '@/test/util';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';

const attempt = () =>
  POST(new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  }));

describe('POST /api/bookings — attempts are rate limited per account', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('answers 429 with Retry-After once one account exceeds 30 attempts, while another account is unaffected', async () => {
    const heavy = await createIdentity();
    const other = await createIdentity();
    currentUser.mockResolvedValue({ identityId: heavy.id, isAdmin: false, roles: [] });
    for (let i = 0; i < 30; i++) expect((await attempt()).status).toBe(400); // rejected as invalid, but counted
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect((await blocked.json()).code).toBe('RATE_LIMITED');

    currentUser.mockResolvedValue({ identityId: other.id, isAdmin: false, roles: [] });
    expect((await attempt()).status).toBe(400);
  });
});
