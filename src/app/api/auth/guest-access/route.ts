import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { people } from '@/modules/core';
import { sendEmail } from '@/modules/auth';
import { t } from '@/modules/content';
import { checkRateLimit } from '@/app/libs/rateLimit';

/**
 * POST /api/auth/guest-access (LY-7)
 * Guest entry by booking reference: {bookingRef, email}. When the pair
 * matches a booking's guest, the guest is emailed a way in — a claim link
 * for invited identities, a login link for active ones.
 *
 * PII rule: a booking code alone NEVER opens anything — the way in always
 * travels to the guest's own email. The response is identical for known
 * and unknown pairs (no enumeration).
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const limit = checkRateLimit(`guest-access:ip:${ip}`, {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      backoffMs: 5 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { bookingRef, email } = body;
    if (!bookingRef || !email || typeof bookingRef !== 'string' || typeof email !== 'string') {
      return NextResponse.json({ error: 'invalid request' }, { status: 400 });
    }

    // The uniform response, sent no matter what we find below
    const ok = NextResponse.json({ ok: true });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingRef.trim() },
      include: {
        guestIdentity: { select: { id: true, email: true, status: true } },
        unit: { select: { project: { select: { name: true } } } },
      },
    });

    const guest = booking?.guestIdentity;
    if (
      !booking ||
      !guest ||
      !guest.email ||
      guest.email.toLowerCase() !== email.trim().toLowerCase()
    ) {
      return ok;
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const homeSpacePath = `/bookings/${booking.id}/home-space`;
    let link: string;
    if (guest.status === 'invited') {
      const token = await people.generateClaimLink(prisma, { identityId: guest.id });
      link = `${baseUrl}/auth/claim?token=${token}&next=${encodeURIComponent(homeSpacePath)}`;
    } else {
      link = `${baseUrl}/login?next=${encodeURIComponent(homeSpacePath)}`;
    }

    // DB copy wins; the EN draft is the fallback so the link always travels
    // even before the keys are translated (same pattern as getLabels).
    const params = { project_name: booking.unit.project.name, link };
    let [subject, bodyText] = await Promise.all([
      t(prisma, 'email.guest_access.subject', params).catch(() => ''),
      t(prisma, 'email.guest_access.body', params).catch(() => ''),
    ]);
    if (!subject || subject === 'email.guest_access.subject' || subject === '—') {
      subject = `Your stay at ${booking.unit.project.name} — your access link`;
    }
    if (!bodyText || !bodyText.includes(link)) {
      bodyText = `Hello!\n\nHere is your personal link to open your stay space at ${booking.unit.project.name}:\n\n${link}\n\nIf you did not request this, simply ignore this email.\n\nmyUNO — serviced living in Phuket`;
    }
    // Best-effort: email failures never leak into the uniform response
    await sendEmail({
      to: guest.email,
      subject,
      html: `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
    }).catch(() => null);

    return ok;
  } catch {
    // Uniform response even on unexpected errors — no enumeration
    return NextResponse.json({ ok: true });
  }
}
