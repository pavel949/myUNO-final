import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { ProspectingAccountStatus } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

interface TransitionRequest {
  status: ProspectingAccountStatus;
}

const accountInclude = {
  identity: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: TransitionRequest = await req.json();

    if (!body.status) {
      return NextResponse.json({ error: 'Missing required field: status' }, { status: 400 });
    }

    const validStatuses: ProspectingAccountStatus[] = [
      'new',
      'contacted',
      'interested',
      'pitched',
      'closed',
    ];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const account = await prisma.prospectingAccount.findUnique({
      where: { id: params.id },
    });

    if (!account) {
      return NextResponse.json({ error: 'Prospecting account not found' }, { status: 404 });
    }

    const updated = await prisma.prospectingAccount.update({
      where: { id: params.id },
      data: {
        status: body.status,
        lastContactedAt: new Date(),
      },
      include: accountInclude,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        identityId: updated.identityId,
        identityName: `${updated.identity.firstName} ${updated.identity.lastName}`.trim(),
        identityEmail: updated.identity.email,
        accountType: updated.accountType,
        status: updated.status,
        reasonForContact: updated.reasonForContact,
        priority: updated.priority,
        assignedTo: updated.assignedTo
          ? {
              id: updated.assignedTo.id,
              email: updated.assignedTo.email,
              name: `${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`.trim(),
            }
          : null,
        lastContactedAt: updated.lastContactedAt?.toISOString() || null,
        expectedCloseAt: updated.expectedCloseAt?.toISOString() || null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PROSPECTING TRANSITION]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
