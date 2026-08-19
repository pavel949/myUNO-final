import { NextRequest, NextResponse } from 'next/server';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  getNotificationSettings,
  setNotificationPreference,
  UNMUTABLE_TYPES,
} from '@/modules/core';

/**
 * What reaches this person, and their right to turn it off.
 *
 * Under the PDPA a person must be able to withdraw a consent they gave. The
 * preference table existed and nothing could write to it, so this is the
 * withdrawal surface as much as it is a settings screen.
 */
export const dynamic = 'force-dynamic';

/**
 * The types a person may govern. Deliberately not every value of the enum:
 * `auth_*` types carry account security (a verification link, a reset) and
 * silencing them locks a person out of their own recovery.
 */
const GOVERNABLE_TYPES: NotificationType[] = [
  'stay_confirmed',
  'stay_request_placed',
  'stay_request_approved',
  'stay_request_declined',
  'stay_hold_expired',
  'stay_prearrival_passports',
  'stay_checkin_instructions',
  'stay_checkout_reminder',
  'stay_cancelled',
  'stay_verification_failed',
  'compliance_tm30_escalation',
];

const CHANNELS: NotificationChannel[] = ['in_app', 'email'];

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getNotificationSettings(
    prisma,
    user.identityId,
    GOVERNABLE_TYPES,
    CHANNELS
  );

  return NextResponse.json({
    settings,
    // Named so the screen can show the switch as fixed with a reason, rather
    // than offering a control that fails when used.
    unmutable: UNMUTABLE_TYPES,
    channels: CHANNELS,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { type, channel, muted } = body ?? {};

  if (!GOVERNABLE_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  }
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }
  if (typeof muted !== 'boolean') {
    return NextResponse.json({ error: 'muted must be true or false' }, { status: 400 });
  }

  try {
    await setNotificationPreference(prisma, user.identityId, type, channel, muted);
    return NextResponse.json({
      settings: await getNotificationSettings(prisma, user.identityId, GOVERNABLE_TYPES, CHANNELS),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save that preference' },
      { status: (error as { code?: string }).code === 'UNMUTABLE' ? 409 : 400 }
    );
  }
}
