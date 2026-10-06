import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { OPERATING_SPACE_CAPABILITIES } from '@/modules/ops';
import { grantRole } from '@/modules/core/roles';

const CAPABILITIES = new Set<string>(OPERATING_SPACE_CAPABILITIES);

const PRESET_TEAMS: Record<string, { name: string; teamType: string }> = {
  portfolio_manager: { name: 'Portfolio management', teamType: 'portfolio_manager' },
  resort_manager: { name: 'Resort management', teamType: 'resort_manager' },
  reservations_manager: { name: 'Reservations', teamType: 'reservations' },
  housekeeping_manager: { name: 'Housekeeping', teamType: 'housekeeping' },
  maintenance_manager: { name: 'Maintenance', teamType: 'maintenance' },
  revenue_manager: { name: 'Revenue & distribution', teamType: 'revenue' },
  finance_manager: { name: 'Finance & owner reporting', teamType: 'finance' },
  custom: { name: 'Operations', teamType: 'custom' },
};

function departmentsForCapabilities(capabilities: string[]) {
  const departments = new Set<string>();
  const has = (capability: string) => capabilities.includes(capability);

  if (has('view_calendar') || has('manage_reservations')) departments.add('reservations');
  if (has('manage_reservations')) departments.add('front_desk');
  if (has('manage_tasks') || has('assign_tasks')) departments.add('guest_care');
  if (has('manage_housekeeping')) departments.add('housekeeping');
  if (has('manage_maintenance')) departments.add('maintenance');
  if (has('manage_pricing') || has('manage_availability')) departments.add('pricing');
  if (has('manage_channels')) departments.add('channels');
  if (has('view_finance') || has('record_expense')) departments.add('finance');
  if (has('generate_owner_report') || has('manage_team')) departments.add('owner_relations');

  return departments;
}

async function reconcileProjectAccess(identityId: string, actorIdentityId: string, affectedProjectIds: string[]) {
  const memberships = await prisma.operatingSpaceMember.findMany({
    where: { identityId, active: true },
    select: {
      capabilities: true,
      operatingSpace: {
        select: {
          units: {
            where: {
              active: true,
              OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
            },
            select: {
              unit: { select: { projectId: true } },
            },
          },
        },
      },
    },
  });

  const byProject = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const departments = departmentsForCapabilities(membership.capabilities);
    for (const scoped of membership.operatingSpace.units) {
      const current = byProject.get(scoped.unit.projectId) ?? new Set<string>();
      for (const department of departments) current.add(department);
      byProject.set(scoped.unit.projectId, current);
    }
  }

  for (const projectId of new Set(affectedProjectIds)) {
    const departments = Array.from(byProject.get(projectId) ?? []).sort();

    if (departments.length) {
      await grantRole({
        identityId,
        role: 'staff_ops',
        scopeType: 'project',
        projectId,
        grantedByIdentityId: actorIdentityId,
      });
    }

    await prisma.projectStaffPermission.upsert({
      where: { projectId_identityId: { projectId, identityId } },
      create: { projectId, identityId, departments },
      update: { departments },
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { spaceId: string } },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await request.json() as {
      identityId?: string;
      capabilities?: string[];
      active?: boolean;
      preset?: string;
    };

    const identityId = body.identityId?.trim();
    const active = body.active !== false;
    const preset = body.preset && PRESET_TEAMS[body.preset] ? body.preset : 'custom';
    const capabilities = Array.from(new Set(
      Array.isArray(body.capabilities)
        ? body.capabilities.filter((capability): capability is string =>
            typeof capability === 'string' && CAPABILITIES.has(capability))
        : [],
    ));

    if (!identityId) {
      return NextResponse.json({ error: 'identityId is required' }, { status: 400 });
    }
    if (active && capabilities.length === 0) {
      return NextResponse.json({ error: 'At least one capability is required' }, { status: 400 });
    }

    const [space, identity] = await Promise.all([
      prisma.operatingSpace.findUnique({
        where: { id: params.spaceId },
        select: {
          id: true,
          status: true,
          units: {
            where: { active: true },
            select: { unit: { select: { projectId: true } } },
          },
          teams: { select: { id: true } },
        },
      }),
      prisma.identity.findUnique({
        where: { id: identityId },
        select: { id: true, status: true },
      }),
    ]);
    if (!space) return NextResponse.json({ error: 'Operating space not found' }, { status: 404 });
    if (!identity || identity.status !== 'active') {
      return NextResponse.json({ error: 'Person is not an active myUNO identity' }, { status: 409 });
    }

    const currentProjectIds = Array.from(new Set(space.units.map((row) => row.unit.projectId)));

    await prisma.$transaction(async (tx) => {
      await tx.operatingSpaceMember.upsert({
        where: {
          operatingSpaceId_identityId: {
            operatingSpaceId: params.spaceId,
            identityId,
          },
        },
        create: {
          operatingSpaceId: params.spaceId,
          identityId,
          capabilities: active ? capabilities : [],
          active,
        },
        update: {
          capabilities: active ? capabilities : [],
          active,
        },
      });

      if (!active) {
        const teamIds = space.teams.map((team) => team.id);
        if (teamIds.length) {
          await tx.operatingTeamMember.updateMany({
            where: { identityId, operatingTeamId: { in: teamIds } },
            data: { active: false },
          });
        }
      } else {
        const teamDef = PRESET_TEAMS[preset];
        const team = await tx.operatingTeam.upsert({
          where: {
            operatingSpaceId_name: {
              operatingSpaceId: params.spaceId,
              name: teamDef.name,
            },
          },
          create: {
            operatingSpaceId: params.spaceId,
            name: teamDef.name,
            teamType: teamDef.teamType,
            active: true,
          },
          update: {
            teamType: teamDef.teamType,
            active: true,
          },
        });

        await tx.operatingTeamMember.upsert({
          where: {
            operatingTeamId_identityId: {
              operatingTeamId: team.id,
              identityId,
            },
          },
          create: { operatingTeamId: team.id, identityId, active: true },
          update: { active: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorIdentityId: guard.actorIdentityId,
          action: active ? 'operating_space.member_updated' : 'operating_space.member_revoked',
          entityType: 'operating_space_member',
          entityId: identityId,
          data: {
            operatingSpaceId: params.spaceId,
            capabilities: active ? capabilities : [],
            preset,
          },
        },
      });
    });

    await reconcileProjectAccess(identityId, guard.actorIdentityId, currentProjectIds);

    return NextResponse.json({
      operatingSpaceId: params.spaceId,
      identityId,
      active,
      capabilities: active ? capabilities : [],
      preset,
    });
  } catch (error) {
    return failed(error, 'Could not update operating-space member');
  }
}
