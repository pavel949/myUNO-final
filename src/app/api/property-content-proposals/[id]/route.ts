import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createContentProposalService, contentProposalFailure } from '@/modules/onboarding';

export const dynamic = 'force-dynamic';
const service = createContentProposalService(prisma);
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) return respond({ error: 'Unauthorized.' }, 401);
    return respond(await service.get(user.identityId, params.id));
  } catch (error) { const result = contentProposalFailure(error); return respond({ error: result.error }, result.status); }
}
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) return respond({ error: 'Unauthorized.' }, 401);
    return respond(await service.update(user.identityId, params.id, await req.json()));
  } catch (error) { const result = contentProposalFailure(error); return respond({ error: result.error }, result.status); }
}
