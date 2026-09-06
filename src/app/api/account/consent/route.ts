import { NextRequest, NextResponse } from 'next/server';
import { CrmConsentPurpose } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  getConsentSummary,
  getConsentHistory,
  grantConsent,
  withdrawConsent,
} from '@/modules/crm';

/**
 * A person's consents, and their right to take one back (PDPA — doc 12, doc 17).
 *
 * `crm_consent` could record that someone consented and had no path anywhere
 * to record that they had changed their mind. Doc 17 describes a consent
 * audit trail *with withdrawal history*; withdrawal is a right under the
 * PDPA, and a right nobody can exercise is not implemented. This is the
 * surface that makes it exercisable.
 *
 * Scoped to the caller's own identity throughout. Consent is the one thing
 * nobody may change on someone else's behalf through a self-service route —
 * staff acting on a phoned-in request go through the service directly, where
 * who acted is recorded on the row.
 */
export const dynamic = 'force-dynamic';

/**
 * `service` is deliberately absent. It is the lawful basis for operating a
 * stay someone has booked — messages about their own arrival, their own
 * invoice — and offering a switch that would stop those is offering a control
 * the platform cannot honour while the booking stands.
 */
const WITHDRAWABLE: CrmConsentPurpose[] = ['marketing', 'property_matching', 'analytics'];

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [summary, history] = await Promise.all([
    getConsentSummary(prisma, user.identityId),
    getConsentHistory(prisma, user.identityId),
  ]);

  return NextResponse.json({
    summary,
    withdrawable: WITHDRAWABLE,
    // The trail is part of the answer, not an internal detail: under a
    // subject-access request this is what the person is entitled to see.
    history: history.map((row) => ({
      purpose: row.purpose,
      status: row.status,
      channel: row.channel,
      capturedAt: row.capturedAt,
      expiresAt: row.expiresAt,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { purpose, granted } = body ?? {};

  if (!WITHDRAWABLE.includes(purpose)) {
    return NextResponse.json(
      { error: 'That is not a consent you can change here' },
      { status: 400 }
    );
  }
  if (typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'granted must be true or false' }, { status: 400 });
  }

  const record = granted ? grantConsent : withdrawConsent;
  await record(prisma, {
    identityId: user.identityId,
    purpose,
    channel: 'account',
    evidence: { surface: 'account_settings' },
  });

  return NextResponse.json({
    summary: await getConsentSummary(prisma, user.identityId),
  });
}
