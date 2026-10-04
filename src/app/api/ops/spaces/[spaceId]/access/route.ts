import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { people } from '@/modules/core';
import {
  OPERATING_SPACE_CAPABILITIES,
  hasOperatingSpaceCapability,
  getOperatingSpaceUnitIds,
} from '@/modules/ops';

export const dynamic = 'force-dynamic';

async function authorize(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const space = await prisma.operatingSpace.findUnique({
    where: { id: spaceId },
    select: { id: true, name: true, status: true },
  });
  if (!space || space.status !== 'active') {
    return { error: NextResponse.json({ error: 'Operating space not found' }, { status: 404 }) };
  }
  if (!user.isAdmin && !(await hasOperatingSpaceCapability(prisma, spaceId, user.identityId, 'manage_team'))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, space };
}

export async function GET(_: NextRequest, { params }: { params: { spaceId: string } }) {
  const auth = await authorize(params.spaceId);
  if (auth.error) return auth.error;
  const unitIds = await getOperatingSpaceUnitIds(prisma, params.spaceId);
  const [units, members, teams] = await Promise.all([
    prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, name: true, project: { select: { id: true, name: true } } },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.operatingSpaceMember.findMany({
      where: { operatingSpaceId: params.spaceId, active: true },
      select: {
        identityId: true,
        capabilities: true,
        identity: { select: { firstName: true, lastName: true, email: true, status: true } },
      },
      orderBy: { identity: { firstName: 'asc' } },
    }),
    prisma.operatingTeam.findMany({
      where: { operatingSpaceId: params.spaceId, active: true },
      select: {
        id: true, name: true, teamType: true,
        members: {
          where: { active: true },
          select: { identityId: true, identity: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  const identities = members.map((member) => member.identityId);
  const unitRoles = identities.length && unitIds.length ? await prisma.roleAssignment.findMany({
    where: {
      identityId: { in: identities },
      role: 'onsite_host',
      status: 'active',
      unitId: { in: unitIds },
    },
    select: { identityId: true, unitId: true },
  }) : [];
  const unitIdsByIdentity = new Map<string, string[]>();
  for (const role of unitRoles) {
    if (!role.unitId) continue;
    const list = unitIdsByIdentity.get(role.identityId) || [];
    list.push(role.unitId);
    unitIdsByIdentity.set(role.identityId, list);
  }
  return NextResponse.json({
    capabilities: OPERATING_SPACE_CAPABILITIES,
    units,
    members: members.map((member) => ({
      ...member,
      unitIds: unitIdsByIdentity.get(member.identityId) || [],
    })),
    teams,
  });
}

export async function POST(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const auth = await authorize(params.spaceId);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null) as {
    action?: string;
    email?: string;
    identityId?: string;
    capabilities?: string[];
    unitIds?: string[];
    name?: string;
    teamType?: string;
    teamId?: string;
    memberIdentityIds?: string[];
  } | null;
  const action = body?.action || '';

  if (action === 'upsert_member') {
    const email = (body?.email || '').trim().toLowerCase();
    let identityId = body?.identityId || '';
    if (!identityId && email) {
      const identity = await prisma.identity.findUnique({
        where: { email },
        select: { id: true, status: true },
      });
      if (!identity || identity.status !== 'active') {
        return NextResponse.json({ error: 'Active myUNO account required' }, { status: 404 });
      }
      identityId = identity.id;
    }
    if (!identityId) return NextResponse.json({ error: 'identityId or email required' }, { status: 400 });

    const requestedCapabilities = Array.from(new Set(body?.capabilities || []))
      .filter((capability) => (OPERATING_SPACE_CAPABILITIES as readonly string[]).includes(capability));
    const spaceUnitIds = await getOperatingSpaceUnitIds(prisma, params.spaceId);
    const requestedUnitIds = Array.from(new Set(body?.unitIds || []))
      .filter((unitId) => spaceUnitIds.includes(unitId));
    if (!requestedUnitIds.length) {
      return NextResponse.json({ error: 'Select at least one managed property' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.operatingSpaceMember.upsert({
        where: { operatingSpaceId_identityId: { operatingSpaceId: params.spaceId, identityId } },
        create: {
          operatingSpaceId: params.spaceId,
          identityId,
          capabilities: requestedCapabilities,
          active: true,
        },
        update: { capabilities: requestedCapabilities, active: true },
      });
      await tx.roleAssignment.updateMany({
        where: {
          identityId,
          role: 'onsite_host',
          unitId: { in: spaceUnitIds.filter((id) => !requestedUnitIds.includes(id)) },
          status: 'active',
        },
        data: { status: 'revoked' },
      });
    });

    for (const unitId of requestedUnitIds) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { projectId: true } });
      if (!unit) continue;
      const existing = await prisma.roleAssignment.findFirst({
        where: { identityId, role: 'onsite_host', unitId, status: 'active' },
        select: { id: true },
      });
      if (!existing) {
        await people.grantRole(prisma, {
          identityId,
          role: 'onsite_host',
          scopeType: 'unit',
          projectId: unit.projectId,
          unitId,
          grantedByIdentityId: auth.user!.identityId,
        });
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_member') {
    const identityId = body?.identityId || '';
    if (!identityId) return NextResponse.json({ error: 'identityId required' }, { status: 400 });
    const spaceUnitIds = await getOperatingSpaceUnitIds(prisma, params.spaceId);
    await prisma.$transaction([
      prisma.operatingSpaceMember.updateMany({
        where: { operatingSpaceId: params.spaceId, identityId },
        data: { active: false },
      }),
      prisma.roleAssignment.updateMany({
        where: { identityId, role: 'onsite_host', unitId: { in: spaceUnitIds }, status: 'active' },
        data: { status: 'revoked' },
      }),
      prisma.operatingTeamMember.updateMany({
        where: {
          identityId,
          operatingTeam: { operatingSpaceId: params.spaceId },
        },
        data: { active: false },
      }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (action === 'create_team') {
    const name = (body?.name || '').trim();
    const teamType = (body?.teamType || 'operations').trim();
    if (!name) return NextResponse.json({ error: 'Team name required' }, { status: 400 });
    const team = await prisma.operatingTeam.create({
      data: { operatingSpaceId: params.spaceId, name, teamType },
      select: { id: true },
    });
    return NextResponse.json({ id: team.id }, { status: 201 });
  }

  if (action === 'set_team_members') {
    const teamId = body?.teamId || '';
    const memberIdentityIds = Array.from(new Set(body?.memberIdentityIds || []));
    const team = await prisma.operatingTeam.findFirst({
      where: { id: teamId, operatingSpaceId: params.spaceId, active: true },
      select: { id: true },
    });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const validMembers = await prisma.operatingSpaceMember.findMany({
      where: { operatingSpaceId: params.spaceId, identityId: { in: memberIdentityIds }, active: true },
      select: { identityId: true },
    });
    const validIds = new Set(validMembers.map((member) => member.identityId));
    const requested = memberIdentityIds.filter((identityId) => validIds.has(identityId));
    await prisma.$transaction(async (tx) => {
      await tx.operatingTeamMember.updateMany({
        where: { operatingTeamId: teamId, identityId: { notIn: requested } },
        data: { active: false },
      });
      for (const identityId of requested) {
        await tx.operatingTeamMember.upsert({
          where: { operatingTeamId_identityId: { operatingTeamId: teamId, identityId } },
          create: { operatingTeamId: teamId, identityId, active: true },
          update: { active: true },
        });
      }
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
