import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

const sentEmails: Array<{ to: string; subject: string; html: string }> = [];
vi.mock('@/modules/auth', () => ({
  sendEmail: vi.fn(async (msg: { to: string; subject: string; html: string }) => {
    sentEmails.push(msg);
  }),
}));

import { POST } from './route';

function makeRequest(body: unknown, ip = '10.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/auth/guest-access', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  });
}

describe('POST /api/auth/guest-access (LY-7)', () => {
  beforeEach(async () => {
    await resetDb();
    sentEmails.length = 0;
  });

  async function seedBooking(guestStatus: 'invited' | 'active' = 'invited') {
    const guest = await createIdentity({
      email: `guest-${Date.now()}@test.com`,
      status: guestStatus,
    });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-05'),
    });
    return { guest, booking };
  }

  it('returns the identical uniform response for matched, mismatched, and unknown pairs', async () => {
    const { guest, booking } = await seedBooking();

    const matched = await POST(
      makeRequest({ bookingRef: booking.id, email: guest.email }, '10.0.0.1')
    );
    const wrongEmail = await POST(
      makeRequest({ bookingRef: booking.id, email: 'stranger@test.com' }, '10.0.0.2')
    );
    const unknownBooking = await POST(
      makeRequest({ bookingRef: 'no-such-booking', email: guest.email }, '10.0.0.3')
    );

    const bodies = await Promise.all(
      [matched, wrongEmail, unknownBooking].map((r) => r.json())
    );
    expect(matched.status).toBe(200);
    expect(wrongEmail.status).toBe(200);
    expect(unknownBooking.status).toBe(200);
    // Byte-identical uniform responses — no enumeration signal
    expect(JSON.stringify(bodies[0])).toBe(JSON.stringify(bodies[1]));
    expect(JSON.stringify(bodies[1])).toBe(JSON.stringify(bodies[2]));
  });

  it('emails a claim link only to the matched guest (invited identity)', async () => {
    const { guest, booking } = await seedBooking('invited');

    await POST(makeRequest({ bookingRef: booking.id, email: guest.email }));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(guest.email);
    expect(sentEmails[0].html).toContain('/auth/claim?token=');

    // A single-use claim token now exists for the guest
    const token = await db.oneTimeToken.findFirst({
      where: { identityId: guest.id, purpose: 'account_claim' },
    });
    expect(token).not.toBeNull();
  });

  it('sends no email on a mismatched pair', async () => {
    const { booking } = await seedBooking();
    await POST(
      makeRequest({ bookingRef: booking.id, email: 'stranger@test.com' }, '10.0.0.9')
    );
    expect(sentEmails).toHaveLength(0);
  });

  it('active identities get a login link, not a claim token', async () => {
    const { guest, booking } = await seedBooking('active');

    await POST(makeRequest({ bookingRef: booking.id, email: guest.email }, '10.0.0.8'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].html).toContain('/login?next=');
    const token = await db.oneTimeToken.findFirst({
      where: { identityId: guest.id, purpose: 'account_claim' },
    });
    expect(token).toBeNull();
  });
});
