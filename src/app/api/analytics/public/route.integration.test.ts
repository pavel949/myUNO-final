import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/test/util';
import { POST } from './route';

describe('POST /api/analytics/public', () => {
  beforeEach(async () => {
    await resetDb();
  });

  function request(body: unknown) {
    return new NextRequest('http://localhost/api/analytics/public', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify(body),
    });
  }

  it('accepts a whitelisted low-risk interaction event', async () => {
    const response = await POST(request({
      eventKey: 'intent_selected',
      dimensions: {
        destination: 'phuket',
        locale: 'en',
        intent: 'monthly',
        source: 'homepage',
        ignoredPii: 'do-not-store-me',
      },
    }));
    expect(response.status).toBe(202);

    const event = await prisma.analyticsEvent.findFirst({
      where: { eventKey: 'intent_selected' },
    });
    expect(event).toBeTruthy();
    expect(event?.dimensions).toMatchObject({
      destination: 'phuket',
      locale: 'en',
      intent: 'monthly',
      source: 'homepage',
    });
    expect(JSON.stringify(event?.dimensions)).not.toContain('do-not-store-me');
  });

  it('rejects business-outcome events that must be emitted by the server', async () => {
    for (const eventKey of ['stay_confirmed', 'quote_succeeded', 'lead_submitted']) {
      const response = await POST(request({ eventKey, dimensions: {} }));
      expect(response.status).toBe(400);
    }

    expect(await prisma.analyticsEvent.count()).toBe(0);
  });
});
