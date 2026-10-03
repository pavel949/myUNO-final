import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import { resolveDistributionPolicy, upsertDistributionPolicy } from '@/modules/distribution';

async function canManage(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  offeringId: string,
  operatingSpaceId: string | null,
) {
  if (user.isAdmin) return true;
  if (!operatingSpaceId) return false;
  const capable = await hasOperatingSpaceCapability(
    prisma,
    operatingSpaceId,
    user.identityId,
    'manage_channels',
  );
  if (!capable) return false;
  const unitIds = await getOperatingSpaceUnitIds(prisma, operatingSpaceId);
  return Boolean(await prisma.commercialOffering.findFirst({
    where: { id: offeringId, unitId: { in: unitIds } },
    select: { id: true },
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: { offeringId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const spaceId = request.nextUrl.searchParams.get('spaceId');
  if (!(await canManage(user, params.offeringId, spaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const policy = await resolveDistributionPolicy(prisma, params.offeringId);
    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Policy unavailable' },
      { status: 404 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { offeringId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as {
    operatingSpaceId?: string;
    supplyOrganizationId?: string | null;
    inventorySource?: 'managed' | 'partner';
    availabilityMode?: 'live' | 'synced' | 'request';
    bookingMode?: 'instant' | 'request' | 'operator_approval' | 'partner_approval' | 'not_agent_bookable';
    agentDistributionEnabled?: boolean;
    directDistributionEnabled?: boolean;
    otaDistributionEnabled?: boolean;
    allowAgentMarkup?: boolean;
    maxAgentMarkupPct?: number | null;
    defaultAgentCommissionPct?: number;
    confirmationSlaMinutes?: number | null;
    staleAfterMinutes?: number | null;
    notes?: string | null;
  };
  const spaceId = body.operatingSpaceId ?? null;
  if (!(await canManage(user, params.offeringId, spaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const policy = await upsertDistributionPolicy(prisma, {
      offeringId: params.offeringId,
      supplyOrganizationId: body.supplyOrganizationId || null,
      inventorySource: body.inventorySource ?? 'managed',
      availabilityMode: body.availabilityMode ?? 'live',
      bookingMode: body.bookingMode ?? 'request',
      agentDistributionEnabled: body.agentDistributionEnabled ?? true,
      directDistributionEnabled: body.directDistributionEnabled ?? true,
      otaDistributionEnabled: body.otaDistributionEnabled ?? false,
      allowAgentMarkup: body.allowAgentMarkup ?? true,
      maxAgentMarkupBps: body.maxAgentMarkupPct == null
        ? null
        : Math.round(Number(body.maxAgentMarkupPct) * 100),
      defaultAgentCommissionBps: Math.round(Number(body.defaultAgentCommissionPct ?? 10) * 100),
      confirmationSlaMinutes: body.confirmationSlaMinutes == null
        ? null
        : Number(body.confirmationSlaMinutes),
      staleAfterMinutes: body.staleAfterMinutes == null
        ? null
        : Number(body.staleAfterMinutes),
      notes: body.notes ?? null,
    });
    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Policy update failed' },
      { status: 400 },
    );
  }
}
