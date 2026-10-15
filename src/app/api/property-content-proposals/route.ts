import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createContentProposalService, contentProposalFailure } from '@/modules/onboarding';

export const dynamic = 'force-dynamic';
const service = createContentProposalService(prisma);
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return respond({ error: 'Unauthorized.' }, 401);
    return respond(await service.list(user.identityId));
  } catch (error) { const result = contentProposalFailure(error); return respond({ error: result.error }, result.status); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return respond({ error: 'Unauthorized.' }, 401);
    return respond(await service.create(user.identityId, await req.json()), 201);
  } catch (error) { const result = contentProposalFailure(error); return respond({ error: result.error }, result.status); }
}
