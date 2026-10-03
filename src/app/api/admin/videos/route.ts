import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { createVideoDraft, publishVideo, archiveVideo } from '@/modules/media';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw createPublicError('unauthorized', 401);
  if (!user.isAdmin) throw createPublicError('forbidden', 403);
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const videos = await prisma.videoPublication.findMany({
      include: { mediaAsset: true },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ videos });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'create') {
      const video = await createVideoDraft(prisma, {
        destinationKey: String(body.destinationKey || 'phuket'),
        slug: String(body.slug || ''),
        locale: String(body.locale || 'en'),
        title: String(body.title || ''),
        description: body.description ? String(body.description) : null,
        mediaAssetId: String(body.mediaAssetId || ''),
        createdByIdentityId: user.identityId,
        recordedOn: body.recordedOn ? new Date(body.recordedOn) : null,
        provenance: body.provenance ? String(body.provenance) : null,
        scopeType: body.scopeType || null,
        scopeId: body.scopeId || null,
      });
      return NextResponse.json({ video }, { status: 201 });
    }

    const videoId = String(body.videoId || '');
    if (!videoId) throw createPublicError('invalid request: videoId is required', 400);
    if (action === 'publish') return NextResponse.json({ video: await publishVideo(prisma, videoId, user.identityId) });
    if (action === 'archive') return NextResponse.json({ video: await archiveVideo(prisma, videoId, user.identityId) });

    throw createPublicError('invalid request: unknown video action', 400);
  } catch (error) {
    return handleError(error);
  }
}
