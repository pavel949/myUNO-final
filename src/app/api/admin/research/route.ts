import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import {
  createResearchDraft,
  addResearchSource,
  submitResearchForReview,
  reviewResearchPublication,
  publishResearchPublication,
  retractResearchPublication,
  addResearchCorrection,
} from '@/modules/research';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw createPublicError('unauthorized', 401);
  if (!user.isAdmin) throw createPublicError('forbidden', 403);
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const publications = await prisma.researchPublication.findMany({
      include: {
        sources: { orderBy: { sourceNumber: 'asc' } },
        corrections: { orderBy: { publicAt: 'desc' } },
        author: { select: { id: true, firstName: true, lastName: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ publications });
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
      const publication = await createResearchDraft(prisma, {
        destinationKey: String(body.destinationKey || 'phuket'),
        slug: String(body.slug || ''),
        locale: String(body.locale || 'en'),
        title: String(body.title || ''),
        summary: String(body.summary || ''),
        body: String(body.body || ''),
        authorIdentityId: user.identityId,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      });
      return NextResponse.json({ publication }, { status: 201 });
    }

    const publicationId = String(body.publicationId || '');
    if (!publicationId) throw createPublicError('invalid request: publicationId is required', 400);

    if (action === 'add_source') {
      const source = await addResearchSource(prisma, publicationId, {
        title: String(body.title || ''),
        publisher: body.publisher ? String(body.publisher) : null,
        url: String(body.url || ''),
        publishedOn: body.publishedOn ? new Date(body.publishedOn) : null,
        note: body.note ? String(body.note) : null,
      });
      return NextResponse.json({ source }, { status: 201 });
    }
    if (action === 'submit') {
      return NextResponse.json({ publication: await submitResearchForReview(prisma, publicationId, user.identityId) });
    }
    if (action === 'review') {
      return NextResponse.json({ publication: await reviewResearchPublication(prisma, publicationId, user.identityId) });
    }
    if (action === 'publish') {
      return NextResponse.json({ publication: await publishResearchPublication(prisma, publicationId, user.identityId) });
    }
    if (action === 'retract') {
      return NextResponse.json({ publication: await retractResearchPublication(prisma, publicationId, user.identityId) });
    }
    if (action === 'correct') {
      const correction = await addResearchCorrection(
        prisma,
        publicationId,
        user.identityId,
        String(body.summary || ''),
        String(body.detail || '')
      );
      return NextResponse.json({ correction }, { status: 201 });
    }

    throw createPublicError('invalid request: unknown research action', 400);
  } catch (error) {
    return handleError(error);
  }
}
