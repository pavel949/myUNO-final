import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createAgentQuote, getAgentContext } from '@/modules/distribution';

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

  const quotes = await prisma.agentQuote.findMany({
    where: { agentIdentityId: agent.identityId },
    include: {
      items: {
        include: {
          unit: { select: { id: true, name: true, project: { select: { name: true } } } },
        },
      },
      clientProtection: { select: { id: true, clientName: true, clientWhatsapp: true } },
      sharedLinks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ quotes });
}

export async function POST(req: NextRequest) {
  const { user, agent } = await context();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      unitId?: string;
      offeringId?: string;
      startDate?: string;
      endDate?: string;
      adults?: number;
      children?: number;
      markupThb?: number;
      clientProtectionId?: string;
      validHours?: number;
      publicNote?: string;
    };
    if (!body.unitId || !body.offeringId || !body.startDate || !body.endDate) throw new Error('QUOTE_INPUT_REQUIRED');
    const startDate = new Date(body.startDate + 'T00:00:00.000Z');
    const endDate = new Date(body.endDate + 'T00:00:00.000Z');
    const validHours = Math.max(1, Math.min(168, Number(body.validHours ?? 24)));
    const quote = await createAgentQuote(prisma, agent, {
      unitId: body.unitId,
      offeringId: body.offeringId,
      startDate,
      endDate,
      adults: Math.max(1, Number(body.adults ?? 1)),
      children: Math.max(0, Number(body.children ?? 0)),
      markupSatang: Math.round(Number(body.markupThb ?? 0) * 100),
      clientProtectionId: body.clientProtectionId || null,
      validUntil: new Date(Date.now() + validHours * 60 * 60 * 1000),
      publicNote: body.publicNote || null,
    });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create quote';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
