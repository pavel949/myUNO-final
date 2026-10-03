import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createAgentShortlist, getAgentContext } from '@/modules/distribution';

async function context() {
  const user = await getCurrentUser();
  if (!user) return { user: null, agent: null };
  const agent = await getAgentContext(prisma, user.identityId);
  return { user, agent: agent ?? (user.isAdmin ? { identityId: user.identityId, agencyOrganizationId: null } : null) };
}

export async function GET() {
  const { user, agent } = await context();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shortlists = await prisma.agentShortlist.findMany({
    where: { agentIdentityId: agent.identityId },
    include: {
      items: {
        include: {
          unit: { select: { id: true, name: true, project: { select: { name: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      clientProtection: { select: { id: true, clientName: true } },
      sharedLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ shortlists });
}

export async function POST(req: NextRequest) {
  const { user, agent } = await context();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json() as {
      title?: string;
      unitIds?: string[];
      clientProtectionId?: string;
      brandMode?: string;
      notes?: string;
    };
    const shortlist = await createAgentShortlist(prisma, agent, {
      title: body.title ?? '',
      unitIds: Array.isArray(body.unitIds) ? body.unitIds : [],
      clientProtectionId: body.clientProtectionId || null,
      brandMode: body.brandMode || 'myuno',
      notes: body.notes || null,
    });
    return NextResponse.json({ shortlist }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shortlist';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
