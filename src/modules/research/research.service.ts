import type { PrismaClient } from '@prisma/client';

export type ResearchDraftInput = {
  destinationKey: string;
  slug: string;
  locale: string;
  title: string;
  summary: string;
  body: string;
  authorIdentityId: string;
  scheduledFor?: Date | null;
};

export type ResearchSourceInput = {
  title: string;
  publisher?: string | null;
  url: string;
  publishedOn?: Date | null;
  note?: string | null;
};

function validHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function createResearchDraft(db: PrismaClient, input: ResearchDraftInput) {
  if (!input.slug.trim() || !input.title.trim() || !input.summary.trim() || !input.body.trim()) {
    throw new Error('Research publication requires slug, title, summary and body');
  }
  return db.researchPublication.create({
    data: {
      destinationKey: input.destinationKey,
      slug: input.slug.trim().toLowerCase(),
      locale: input.locale,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      authorIdentityId: input.authorIdentityId,
      scheduledFor: input.scheduledFor ?? null,
    },
  });
}

export async function addResearchSource(
  db: PrismaClient,
  publicationId: string,
  input: ResearchSourceInput
) {
  if (!validHttpUrl(input.url)) throw new Error('Research source URL must be http(s)');
  const publication = await db.researchPublication.findUnique({
    where: { id: publicationId },
    select: { status: true },
  });
  if (!publication) throw new Error('Research publication not found');
  if (publication.status !== 'draft') throw new Error('Sources are frozen once review begins');
  const last = await db.researchSource.aggregate({
    where: { publicationId },
    _max: { sourceNumber: true },
  });
  return db.researchSource.create({
    data: {
      publicationId,
      sourceNumber: (last._max.sourceNumber ?? 0) + 1,
      title: input.title.trim(),
      publisher: input.publisher?.trim() || null,
      url: input.url.trim(),
      publishedOn: input.publishedOn ?? null,
      note: input.note?.trim() || null,
    },
  });
}

export async function submitResearchForReview(
  db: PrismaClient,
  publicationId: string,
  actorIdentityId: string
) {
  const publication = await db.researchPublication.findUnique({
    where: { id: publicationId },
    include: { sources: true },
  });
  if (!publication) throw new Error('Research publication not found');
  if (publication.authorIdentityId !== actorIdentityId) throw new Error('Only the author can submit this draft');
  if (publication.status !== 'draft') throw new Error('Only a draft can be submitted for review');
  if (publication.sources.length === 0) throw new Error('At least one numbered source is required before review');
  return db.researchPublication.update({
    where: { id: publicationId },
    data: { status: 'in_review', reviewerIdentityId: null, reviewedAt: null },
  });
}

export async function reviewResearchPublication(
  db: PrismaClient,
  publicationId: string,
  reviewerIdentityId: string
) {
  const publication = await db.researchPublication.findUnique({
    where: { id: publicationId },
    include: { sources: true },
  });
  if (!publication) throw new Error('Research publication not found');
  if (publication.status !== 'in_review') throw new Error('Publication is not awaiting review');
  if (publication.authorIdentityId === reviewerIdentityId) {
    throw new Error('Independent review must be completed by another identity');
  }
  if (publication.sources.length === 0) throw new Error('Reviewed research must retain at least one source');
  return db.researchPublication.update({
    where: { id: publicationId },
    data: { status: 'reviewed', reviewerIdentityId, reviewedAt: new Date() },
  });
}

export async function publishResearchPublication(
  db: PrismaClient,
  publicationId: string,
  actorIdentityId: string
) {
  const publication = await db.researchPublication.findUnique({
    where: { id: publicationId },
    include: { sources: true },
  });
  if (!publication) throw new Error('Research publication not found');
  if (publication.status !== 'reviewed') throw new Error('Publication must pass independent review before publishing');
  if (!publication.reviewerIdentityId || publication.reviewerIdentityId === publication.authorIdentityId) {
    throw new Error('Independent reviewer is required');
  }
  if (publication.sources.length === 0) throw new Error('Published research requires numbered sources');
  const actor = await db.identity.findUnique({ where: { id: actorIdentityId }, select: { isAdmin: true } });
  if (!actor?.isAdmin) throw new Error('Admin approval is required to publish research');
  const now = new Date();
  if (publication.scheduledFor && publication.scheduledFor > now) {
    throw new Error('Scheduled publication time has not been reached');
  }
  return db.researchPublication.update({
    where: { id: publicationId },
    data: { status: 'published', publishedAt: now, retractedAt: null },
  });
}

export async function retractResearchPublication(
  db: PrismaClient,
  publicationId: string,
  actorIdentityId: string
) {
  const actor = await db.identity.findUnique({ where: { id: actorIdentityId }, select: { isAdmin: true } });
  if (!actor?.isAdmin) throw new Error('Admin approval is required to retract research');
  return db.researchPublication.update({
    where: { id: publicationId },
    data: { status: 'retracted', retractedAt: new Date() },
  });
}

export async function addResearchCorrection(
  db: PrismaClient,
  publicationId: string,
  createdByIdentityId: string,
  summary: string,
  detail: string
) {
  const publication = await db.researchPublication.findUnique({
    where: { id: publicationId },
    select: { status: true },
  });
  if (!publication || !['published', 'retracted'].includes(publication.status)) {
    throw new Error('Corrections can only be appended to a publication that reached the public record');
  }
  if (!summary.trim() || !detail.trim()) throw new Error('Correction summary and detail are required');
  return db.researchCorrection.create({
    data: { publicationId, createdByIdentityId, summary: summary.trim(), detail: detail.trim() },
  });
}

export async function listPublishedResearch(db: PrismaClient, destinationKey: string, locale?: string) {
  return db.researchPublication.findMany({
    where: {
      destinationKey,
      status: 'published',
      publishedAt: { lte: new Date() },
      ...(locale ? { locale } : {}),
    },
    include: {
      sources: { orderBy: { sourceNumber: 'asc' } },
      corrections: { orderBy: { publicAt: 'asc' } },
    },
    orderBy: { publishedAt: 'desc' },
  });
}

export async function getPublishedResearch(
  db: PrismaClient,
  destinationKey: string,
  slug: string,
  locale?: string
) {
  return db.researchPublication.findFirst({
    where: {
      destinationKey,
      slug,
      status: 'published',
      publishedAt: { lte: new Date() },
      ...(locale ? { locale } : {}),
    },
    include: {
      sources: { orderBy: { sourceNumber: 'asc' } },
      corrections: { orderBy: { publicAt: 'asc' } },
    },
  });
}
