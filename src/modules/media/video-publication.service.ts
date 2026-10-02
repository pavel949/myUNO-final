import type { PrismaClient } from '@prisma/client';

export type VideoDraftInput = {
  destinationKey: string;
  slug: string;
  locale: string;
  title: string;
  description?: string | null;
  mediaAssetId: string;
  createdByIdentityId: string;
  recordedOn?: Date | null;
  provenance?: string | null;
  scopeType?: 'area' | 'project' | 'unit' | null;
  scopeId?: string | null;
};

async function assertScope(db: PrismaClient, scopeType?: string | null, scopeId?: string | null) {
  if (!scopeType && !scopeId) return;
  if (!scopeType || !scopeId) throw new Error('Video scope requires both type and id');
  if (scopeType === 'area') {
    if (!(await db.area.findUnique({ where: { id: scopeId }, select: { id: true } }))) throw new Error('Video area scope not found');
    return;
  }
  if (scopeType === 'project') {
    if (!(await db.project.findUnique({ where: { id: scopeId }, select: { id: true } }))) throw new Error('Video project scope not found');
    return;
  }
  if (scopeType === 'unit') {
    if (!(await db.unit.findUnique({ where: { id: scopeId }, select: { id: true } }))) throw new Error('Video unit scope not found');
    return;
  }
  throw new Error('Unsupported video scope type');
}

export async function createVideoDraft(db: PrismaClient, input: VideoDraftInput) {
  const asset = await db.mediaAsset.findUnique({
    where: { id: input.mediaAssetId },
    select: { id: true, kind: true, mimeType: true, encrypted: true },
  });
  if (!asset || asset.kind !== 'video' || asset.encrypted) {
    throw new Error('Video publication requires a public video MediaAsset');
  }
  if (!['video/mp4', 'video/webm'].includes(asset.mimeType)) {
    throw new Error('Video publication requires direct-play MP4 or WebM media');
  }
  await assertScope(db, input.scopeType, input.scopeId);
  return db.videoPublication.create({
    data: {
      destinationKey: input.destinationKey,
      slug: input.slug.trim().toLowerCase(),
      locale: input.locale,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      mediaAssetId: input.mediaAssetId,
      createdByIdentityId: input.createdByIdentityId,
      recordedOn: input.recordedOn ?? null,
      provenance: input.provenance?.trim() || null,
      scopeType: input.scopeType ?? null,
      scopeId: input.scopeId ?? null,
    },
  });
}

export async function publishVideo(
  db: PrismaClient,
  videoId: string,
  actorIdentityId: string
) {
  const actor = await db.identity.findUnique({ where: { id: actorIdentityId }, select: { isAdmin: true } });
  if (!actor?.isAdmin) throw new Error('Admin approval is required to publish video');
  const video = await db.videoPublication.findUnique({
    where: { id: videoId },
    include: { mediaAsset: true },
  });
  if (!video) throw new Error('Video publication not found');
  if (video.mediaAsset.kind !== 'video' || video.mediaAsset.encrypted) throw new Error('Video media is not publicly publishable');
  if (!video.provenance?.trim()) throw new Error('Video provenance is required before publication');
  return db.videoPublication.update({
    where: { id: videoId },
    data: { status: 'published', publishedAt: new Date() },
  });
}

export async function archiveVideo(db: PrismaClient, videoId: string, actorIdentityId: string) {
  const actor = await db.identity.findUnique({ where: { id: actorIdentityId }, select: { isAdmin: true } });
  if (!actor?.isAdmin) throw new Error('Admin approval is required to archive video');
  return db.videoPublication.update({
    where: { id: videoId },
    data: { status: 'archived' },
  });
}

export async function listPublishedVideos(db: PrismaClient, destinationKey: string, locale?: string) {
  return db.videoPublication.findMany({
    where: {
      destinationKey,
      status: 'published',
      publishedAt: { lte: new Date() },
      ...(locale ? { locale } : {}),
    },
    include: { mediaAsset: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getPublishedVideo(
  db: PrismaClient,
  destinationKey: string,
  slug: string,
  locale?: string
) {
  return db.videoPublication.findFirst({
    where: {
      destinationKey,
      slug,
      status: 'published',
      publishedAt: { lte: new Date() },
      ...(locale ? { locale } : {}),
    },
    include: { mediaAsset: true },
  });
}
