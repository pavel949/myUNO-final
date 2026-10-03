import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createAgentShareLink, getAgentContext } from '@/modules/distribution';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const resolved = await getAgentContext(prisma, user.identityId);
  const agent = resolved ?? (user.isAdmin ? { identityId: user.identityId, agencyOrganizationId: null } : null);
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      shortlistId?: string;
      quoteId?: string;
      brandMode?: string;
      validDays?: number;
    };
    const validDays = Math.max(1, Math.min(30, Number(body.validDays ?? 7)));
    const link = await createAgentShareLink(prisma, agent, {
      shortlistId: body.shortlistId,
      quoteId: body.quoteId,
      brandMode: body.brandMode || 'myuno',
      expiresAt: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000),
    });
    return NextResponse.json({
      link,
      path: '/a/' + link.token,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create share link';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
