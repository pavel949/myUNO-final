import { NextRequest, NextResponse } from 'next/server';
import { AnnouncementAudience } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { createAnnouncement, resolvePostingAuthority } from '@/modules/comms';
import { logAudit } from '@/modules/audit';

/**
 * Write an announcement (doc 09 §3).
 *
 * `createAnnouncement` and `publishAnnouncement` had no caller anywhere: the
 * home space rendered announcements that nothing in the product could ever
 * write. This is the missing half.
 *
 * The draft is created here; publishing is a second, separate call, because
 * publishing notifies an entire building and should not be a side effect of
 * typing.
 */

const AUDIENCES: AnnouncementAudience[] = [
  'everyone',
  'owners',
  'residents',
  'guests_in_stay',
  'staff',
];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { projectId, title, audience, isPinned, isImportant, expiresAt } = body;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'A message is required' }, { status: 400 });
  }
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: 'Unknown audience' }, { status: 400 });
  }

  if (
    !(await can({
      identity,
      action: 'comms:post_announcements',
      resource: { projectId },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // The voice comes from the role, never from the request. See
  // resolvePostingAuthority: a client-supplied `postedAs` would let staff sign
  // a broadcast as the juristic person that governs the building.
  let authority;
  try {
    authority = await resolvePostingAuthority(prisma, user.identityId, projectId, identity.isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: (error as { code?: string }).code === 'NOT_AUTHORIZED' ? 403 : 400 }
    );
  }

  const expiry = expiresAt ? new Date(expiresAt) : undefined;
  if (expiry && Number.isNaN(expiry.getTime())) {
    return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
  }

  const created = await createAnnouncement(prisma, {
    projectId,
    createdByIdentityId: user.identityId,
    organizationId: authority.organizationId ?? undefined,
    title: title.trim(),
    body: body.body.trim(),
    audience,
    postedAs: authority.postedAs,
    isPinned: Boolean(isPinned),
    isImportant: Boolean(isImportant),
    expiresAt: expiry,
  });

  await logAudit({
    actorIdentityId: user.identityId,
    action: 'comms:announcement_drafted',
    entityType: 'Announcement',
    entityId: created.id,
    data: { projectId, audience, postedAs: authority.postedAs },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
