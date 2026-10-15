import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createContentProposalService, contentProposalFailure } from '@/modules/onboarding';

export const dynamic = 'force-dynamic';
const service = createContentProposalService(prisma);
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    return NextResponse.json(await service.review(user.identityId, params.id, await req.json()), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const result = contentProposalFailure(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
