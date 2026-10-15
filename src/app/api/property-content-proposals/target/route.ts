import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createContentProposalService, contentProposalFailure } from '@/modules/onboarding';

export const dynamic = 'force-dynamic';
const service = createContentProposalService(prisma);
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return respond({ error: 'Unauthorized.' }, 401);
    return respond(await service.target(user.identityId, req.nextUrl.searchParams.get('scope'), req.nextUrl.searchParams.get('id')));
  } catch (error) { const result = contentProposalFailure(error); return respond({ error: result.error }, result.status); }
}
