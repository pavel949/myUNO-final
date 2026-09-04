import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { ProspectingAccountStatus, ProspectingAccountType } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

interface CreateProspectingAccountRequest {
  identityId: string;
  accountType: ProspectingAccountType;
  reasonForContact?: string;
  priority?: number;
  assignedToIdentityId?: string;
  expectedCloseAt?: string;
}

const accountInclude = {
  identity: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

function serializeAccount(account: {
  id: string;
  identityId: string;
  accountType: ProspectingAccountType;
  status: ProspectingAccountStatus;
  reasonForContact: string | null;
  priority: number;
  lastContactedAt: Date | null;
  expectedCloseAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identity: { id: string; email: string | null; firstName: string; lastName: string };
  assignedTo: { id: string; email: string | null; firstName: string; lastName: string } | null;
}) {
  return {
    id: account.id,
    identityId: account.identityId,
    identityName: `${account.identity.firstName} ${account.identity.lastName}`.trim(),
    identityEmail: account.identity.email,
    accountType: account.accountType,
    status: account.status,
    reasonForContact: account.reasonForContact,
    priority: account.priority,
    assignedTo: account.assignedTo
      ? {
          id: account.assignedTo.id,
          email: account.assignedTo.email,
          name: `${account.assignedTo.firstName} ${account.assignedTo.lastName}`.trim(),
        }
      : null,
    lastContactedAt: account.lastContactedAt?.toISOString() || null,
    expectedCloseAt: account.expectedCloseAt?.toISOString() || null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const url = new URL(req.url);
    const identityId = url.searchParams.get('identityId');
    const status = url.searchParams.get('status') as ProspectingAccountStatus | null;
    const accountType = url.searchParams.get('accountType') as ProspectingAccountType | null;
    const assignedToId = url.searchParams.get('assignedToId');
    const statusesParam = url.searchParams.get('statuses');

    const where: {
      identityId?: string;
      status?: ProspectingAccountStatus | { in: ProspectingAccountStatus[] };
      accountType?: ProspectingAccountType;
      assignedToIdentityId?: string;
    } = {};

    if (identityId) where.identityId = identityId;
    if (status) where.status = status;
    if (statusesParam) {
      where.status = {
        in: statusesParam.split(',').filter(Boolean) as ProspectingAccountStatus[],
      };
    }
    if (accountType) where.accountType = accountType;
    if (assignedToId) where.assignedToIdentityId = assignedToId;

    const accounts = await prisma.prospectingAccount.findMany({
      where,
      include: accountInclude,
      orderBy: [{ priority: 'desc' }, { expectedCloseAt: 'asc' }],
      take: 100,
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.map(serializeAccount),
    });
  } catch (error) {
    console.error('[PROSPECTING GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: CreateProspectingAccountRequest = await req.json();

    if (!body.identityId || !body.accountType) {
      return NextResponse.json(
        { error: 'Missing required fields: identityId, accountType' },
        { status: 400 }
      );
    }

    const validAccountTypes: ProspectingAccountType[] = [
      'owner',
      'developer',
      'institutional_partner',
    ];
    if (!validAccountTypes.includes(body.accountType)) {
      return NextResponse.json(
        { error: `Invalid account type. Must be one of: ${validAccountTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const identity = await prisma.identity.findUnique({ where: { id: body.identityId } });
    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    if (body.assignedToIdentityId) {
      const assignee = await prisma.identity.findUnique({
        where: { id: body.assignedToIdentityId },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Assigned person not found' }, { status: 404 });
      }
    }

    const expectedCloseAt = body.expectedCloseAt ? new Date(body.expectedCloseAt) : null;
    if (body.expectedCloseAt && isNaN(expectedCloseAt?.getTime() ?? NaN)) {
      return NextResponse.json({ error: 'Invalid date format for expectedCloseAt' }, { status: 400 });
    }

    const account = await prisma.prospectingAccount.create({
      data: {
        identityId: body.identityId,
        accountType: body.accountType,
        reasonForContact: body.reasonForContact,
        priority: body.priority ?? 1,
        assignedToIdentityId: body.assignedToIdentityId,
        expectedCloseAt,
      },
      include: accountInclude,
    });

    return NextResponse.json({ success: true, account: serializeAccount(account) });
  } catch (error) {
    console.error('[PROSPECTING POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
