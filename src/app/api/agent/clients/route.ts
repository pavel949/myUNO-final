import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext, registerProtectedClient } from '@/modules/distribution';

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

  const clients = await prisma.agentClientProtection.findMany({
    where: { agentIdentityId: agent.identityId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const { user, agent } = await context();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!agent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      clientName?: string;
      clientPhone?: string;
      clientWhatsapp?: string;
      transactionScope?: string;
      destinationScope?: string;
      protectionDays?: number;
      notes?: string;
    };
    const protectionDays = Math.max(1, Math.min(365, Number(body.protectionDays ?? 90)));
    const expiresAt = new Date(Date.now() + protectionDays * 24 * 60 * 60 * 1000);
    const client = await registerProtectedClient(prisma, agent, {
      clientName: body.clientName ?? '',
      clientPhone: body.clientPhone || null,
      clientWhatsapp: body.clientWhatsapp || null,
      transactionScope: body.transactionScope || 'all',
      destinationScope: body.destinationScope || 'Phuket',
      expiresAt,
      notes: body.notes || null,
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to protect client';
    return NextResponse.json({ error: message }, { status: message === 'CLIENT_ALREADY_PROTECTED' ? 409 : 400 });
  }
}
