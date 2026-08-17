import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity } from '@/test/util';
import { seedConfig } from '@/modules/config/seed';
import { seedContent } from '@/modules/content/seed';
import { POST } from './route';

/**
 * T-042: the public lead form is unauthenticated and, on success, opens a
 * thread and alerts every admin. It has to be bounded.
 */
describe('POST /api/leads — rate limiting (T-042)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    await seedContent(db);
    await createIdentity({ email: 'admin@ignatev.test', isAdmin: true });
  });

  function submit(ip: string, name = 'Anna') {
    return POST(
      new NextRequest('https://myuno.app/api/leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({
          audience: 'owners',
          name,
          contact: '+66800000000',
          consent: true,
        }),
      })
    );
  }

  it('accepts an ordinary submission', async () => {
    const response = await submit('203.0.113.10');
    expect(response.status).toBe(200);
  });

  it('cuts off a flood from one address and says when to come back', async () => {
    const ip = '203.0.113.20';

    // The limiter allows five in the window.
    for (let i = 0; i < 5; i++) {
      expect((await submit(ip, `Sender ${i}`)).status).toBe(200);
    }

    const blocked = await submit(ip, 'Sender 6');

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('does not punish a different visitor for the flood', async () => {
    const flooder = '203.0.113.30';
    for (let i = 0; i < 6; i++) {
      await submit(flooder, `Flood ${i}`);
    }

    // A shared limit would let one script silence every real enquiry.
    expect((await submit('203.0.113.31', 'Real person')).status).toBe(200);
  });

  it('stores nothing for a blocked request', async () => {
    const ip = '203.0.113.40';
    for (let i = 0; i < 5; i++) {
      await submit(ip, `Sender ${i}`);
    }

    const before = await db.thread.count();
    await submit(ip, 'Blocked sender');

    expect(await db.thread.count()).toBe(before);
  });
});
