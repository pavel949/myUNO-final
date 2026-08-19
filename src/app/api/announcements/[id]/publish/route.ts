import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { publishAnnouncement, unpublishAnnouncement } from '@/modules/comms';
import { logAudit } from '@/modules/audit';

/**
 * Publish a draft, or withdraw a published announcement.
 *
 * Separate from creating it on purpose: publishing sends a notification to
 * every person in the audience across the whole project, and that should be a
 * decision someone takes, not something that happens because a form was
 * submitted.
 */

async function authorize(announcementId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, projectId: true, audience: true },
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

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  try {
    await publishAnnouncement(prisma, params.id, auth.user!.identityId, auth.identity!.isAdmin);
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'NOT_AUTHORIZED' ? 403 : code === 'ALREADY_PUBLISHED' ? 409 : 400 }
    );
  }

  // A project-wide broadcast is a privileged act with a named author, and the
  // audit trail is where that is provable afterwards.
  await logAudit({
    actorIdentityId: auth.user!.identityId,
    action: 'comms:announcement_published',
    entityType: 'Announcement',
    entityId: params.id,
    data: { projectId: auth.announcement!.projectId, audience: auth.announcement!.audience },
  });

  return NextResponse.json({ status: 'published' });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  try {
    await unpublishAnnouncement(
      prisma,
      params.id,
      auth.user!.identityId,
      auth.identity!.isAdmin
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  await logAudit({
    actorIdentityId: auth.user!.identityId,
    action: 'comms:announcement_unpublished',
    entityType: 'Announcement',
    entityId: params.id,
    data: { projectId: auth.announcement!.projectId },
  });

  return NextResponse.json({ status: 'unpublished' });
}
