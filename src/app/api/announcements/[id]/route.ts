import { NextRequest, NextResponse } from 'next/server';
import { AnnouncementAudience } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { updateAnnouncement, deleteAnnouncement } from '@/modules/comms';
import { logAudit } from '@/modules/audit';

/** Edit or discard a draft. Published announcements are neither — they are withdrawn. */

const AUDIENCES: AnnouncementAudience[] = [
  'everyone',
  'owners',
  'residents',
  'guests_in_stay',
  'staff',
];

async function authorize(announcementId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, projectId: true },
  });
  if (!announcement) {
    return { error: NextResponse.json({ error: 'Announcement not found' }, { status: 404 }) };
  }

  if (
    !(await can({
      identity,
      action: 'comms:post_announcements',
      resource: { projectId: announcement.projectId },
    }))
  ) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, identity, announcement };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  if (body.audience !== undefined && !AUDIENCES.includes(body.audience)) {
    return NextResponse.json({ error: 'Unknown audience' }, { status: 400 });
  }

  // `postedAs` is absent by design: the voice follows the role that wrote the
  // draft and is not an editable field.
  const input = {
    ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
    ...(typeof body.body === 'string' ? { body: body.body.trim() } : {}),
    ...(body.audience !== undefined ? { audience: body.audience } : {}),
    ...(body.isPinned !== undefined ? { isPinned: Boolean(body.isPinned) } : {}),
    ...(body.isImportant !== undefined ? { isImportant: Boolean(body.isImportant) } : {}),
    ...(body.expiresAt !== undefined
      ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
      : {}),
  };

  if (input.expiresAt instanceof Date && Number.isNaN(input.expiresAt.getTime())) {
    return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
  }

  try {
    await updateAnnouncement(prisma, params.id, auth.user!.identityId, input);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json({ status: 'updated' });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  try {
    await deleteAnnouncement(prisma, params.id, auth.user!.identityId);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  await logAudit({
    actorIdentityId: auth.user!.identityId,
    action: 'comms:announcement_deleted',
    entityType: 'Announcement',
    entityId: params.id,
    data: { projectId: auth.announcement!.projectId },
  });

  return NextResponse.json({ status: 'deleted' });
}
