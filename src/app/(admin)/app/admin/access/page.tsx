import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import FounderGovernanceClient from './founder-governance-client';

export const dynamic = 'force-dynamic';

export default async function FounderGovernancePage() {
  const [admins, organizations, projects, spaces, labels] = await Promise.all([
    prisma.identity.findMany({
      where: { isAdmin: true, status: 'active' },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.organization.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        units: {
          where: { status: { not: 'offboarded' } },
          select: { id: true, name: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.operatingSpace.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        key: true,
        name: true,
        timezone: true,
        organizationId: true,
        organization: { select: { name: true } },
        units: {
          where: { active: true },
          select: {
            unitId: true,
            unit: {
              select: {
                id: true,
                name: true,
                projectId: true,
                project: { select: { name: true } },
              },
            },
          },
          orderBy: { unit: { name: 'asc' } },
        },
        members: {
          select: {
            identityId: true,
            active: true,
            capabilities: true,
            identity: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                isAdmin: true,
              },
            },
          },
          orderBy: { identity: { firstName: 'asc' } },
        },
        teams: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            teamType: true,
            members: {
              where: { active: true },
              select: { identityId: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    getLabels({
      'admin.governance.kicker': 'FOUNDER CONTROL PLANE',
      'admin.governance.title': 'Access & operating governance',
      'admin.governance.subtitle': 'Control who can run each portfolio, resort and operating space. Founder / Super Admin remains platform-wide and is never limited by these scopes.',
      'admin.governance.root_title': 'Founder / Super Admin',
      'admin.governance.root_hint': 'Root administrators can see and operate the entire platform. Operating-space permissions below constrain delegated users, not platform admins.',
      'admin.governance.spaces_title': 'Operating spaces',
      'admin.governance.scope_title': 'Managed inventory scope',
      'admin.governance.people_title': 'Leadership & team access',
      'admin.governance.create_title': 'Create operating space',
      'admin.governance.create_hint': 'Use an operating space for one resort or for a distributed managed portfolio across several projects.',
      'admin.governance.audit_link': 'Open audit trail',
      'admin.governance.people_link': 'People & roles',
      'admin.governance.projects_link': 'Projects',
      'admin.governance.root_badge': 'Founder / Super Admin · Root',
      'admin.governance.metrics_homes': 'homes',
      'admin.governance.metrics_people': 'people',
      'admin.governance.create_action': 'Create operating space',
      'admin.governance.no_inventory': 'No managed inventory yet',
      'admin.governance.open_workspace': 'Open operating workspace',
      'admin.governance.scope_hint': 'Select the exact homes this leadership team is allowed to operate.',
      'admin.governance.scope_save': 'Save scope',
      'admin.governance.toggle_project': 'Toggle project',
      'admin.governance.people_hint': 'Manager titles are presets over canonical capabilities; access is still enforced by project and operating-space scope.',
      'admin.governance.current_team': 'Current leadership & team',
      'admin.governance.capabilities_suffix': 'capabilities',
      'admin.governance.no_managers': 'No delegated managers yet.',
      'admin.governance.add_person': 'Add / find person',
      'admin.governance.search': 'Search',
      'admin.governance.root_badge_short': 'ROOT ADMIN',
      'admin.governance.root_identity_hint': 'This identity is already Founder / Super Admin. Root access is platform-wide; delegated operating-space settings do not restrict it.',
      'admin.governance.preset_label': 'Responsibility preset',
      'admin.governance.update_access': 'Update access',
      'admin.governance.assign_access': 'Assign to operating space',
      'admin.governance.revoke_access': 'Revoke operating access',
      'admin.governance.select_person_hint': 'Select an existing team member or search for a myUNO user to configure delegated access.',
      'admin.governance.empty_space': 'Create the first operating space to delegate portfolio or resort management.',
    }),
  ]);

  const serializedSpaces = spaces.map((space) => ({
    ...space,
    members: space.members.map((member) => ({
      ...member,
      preset: space.teams.find((team) =>
        team.members.some((teamMember) => teamMember.identityId === member.identityId)
      )?.teamType ?? 'custom',
    })),
  }));

  return (
    <FounderGovernanceClient
      admins={admins}
      organizations={organizations}
      projects={projects}
      spaces={serializedSpaces}
      labels={labels}
    />
  );
}
