import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can, people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import { sendEmail } from '@/modules/auth/email';
import { logAudit } from '@/modules/audit';

/**
 * Invite someone onto the platform, and send them the link that lets them in.
 *
 * The entire claim flow already existed — token, emailed link, landing page,
 * password form, all tested — and **nothing could create an invited person**,
 * so it began nowhere. An owner handing over a unit had no way in. This is the
 * missing first step of F-OWN-1.
 *
 * The link is also returned to the caller. That is deliberate rather than lazy:
 * this clientele lives on Telegram and WhatsApp, and an operator sitting with
 * an owner needs to be able to hand it over directly instead of hoping an email
 * survives a spam filter. It is shown once, to an admin who already has the
 * power to reset the account anyway.
 */

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({ identity, action: 'people:edit', resource: { resourceType: 'platform' } }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  let invited;
  try {
    invited = await people.inviteIdentity(prisma, {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      preferredLocale: body.preferredLocale,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  // Someone with a working password has nothing to claim. Say so plainly and
  // send nothing — a claim link they cannot redeem would only make them think
  // their existing password had stopped working.
  if (invited.alreadyActive) {
    return NextResponse.json({
      identity: publicShape(invited.identity),
      created: false,
      alreadyActive: true,
      claimUrl: null,
    });
  }

  // How long the link lives is a business rule, so it comes from config.
  const ttlMinutes = (await getConfig(prisma, 'auth.token_ttl_minutes.account_claim').catch(
    () => null
  )) as number | null;

  const token = await people.generateClaimLink(prisma, {
    identityId: invited.identity.id,
    ...(typeof ttlMinutes === 'number' ? { ttlMinutes } : {}),
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const claimUrl = `${baseUrl}/auth/claim?token=${token}`;

  // Best-effort: an operator who has the link in front of them can still pass
  // it on, so a bounced email must not fail the invitation.
  let emailed = true;
  try {
    await sendEmail({
      to: invited.identity.email!,
      subject: 'Your myUNO account',
      html: `
        <p>Hello ${invited.identity.firstName},</p>
        <p><a href="${claimUrl}">Set your password and open your account</a></p>
        <p>Or copy this link: ${claimUrl}</p>
      `,
    });
  } catch {
    emailed = false;
  }

  await logAudit({
    actorIdentityId: user.identityId,
    action: invited.created ? 'people:invited' : 'people:invite_resent',
    entityType: 'Identity',
    entityId: invited.identity.id,
    // Never the address and never the token: one is personal data, the other
    // is a working key to the account (doc 12).
    data: { emailed },
  });

  return NextResponse.json(
    {
      identity: publicShape(invited.identity),
      created: invited.created,
      alreadyActive: false,
      emailed,
      claimUrl,
    },
    { status: invited.created ? 201 : 200 }
  );
}

function publicShape(identity: {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  status: string;
}) {
  return {
    id: identity.id,
    email: identity.email,
    firstName: identity.firstName,
    lastName: identity.lastName,
    status: identity.status,
  };
}
