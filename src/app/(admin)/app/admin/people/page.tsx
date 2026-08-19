import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import PeopleAdminClient from './people-client';

export const dynamic = 'force-dynamic';

/**
 * People & Roles (doc 08 §6.5).
 *
 * The APIs existed — search, grant, revoke, block, unblock — and nothing called
 * any of them. So **no role could be granted through the application at all**:
 * every owner, staff member and provider had to be wired in by hand against the
 * database. Roles are data, not code branches (CLAUDE.md), which only helps if
 * someone can edit the data.
 */
export default async function AdminPeoplePage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const labels = await getLabels({
    'admin.people.title': 'People & roles',
    'admin.people.search': 'Search by name, email or phone',
    'admin.people.searching': 'Searching…',
    'admin.people.none': 'Nobody matches that search.',
    'admin.people.roles_held': 'Roles held',
    'admin.people.no_roles': 'No roles yet.',
    'admin.people.grant': 'Grant a role',
    'admin.people.role': 'Role',
    'admin.people.scope': 'Scope',
    'admin.people.scope_platform': 'Whole platform',
    'admin.people.scope_project': 'One project',
    'admin.people.project': 'Project',
    'admin.people.grant_submit': 'Grant',
    'admin.people.revoke': 'Revoke',
    'admin.people.granting': 'Granting…',
    'admin.people.block': 'Block',
    'admin.people.unblock': 'Unblock',
    'admin.people.blocked': 'Blocked',
    'admin.people.block_warning': 'Blocking removes access immediately, everywhere.',
    'admin.people.error': 'That did not work.',
    'admin.people.scope_note': 'A project role applies to every unit in that project. Platform scope is for staff and admin only.',
  });

  return <PeopleAdminClient projects={projects} labels={labels} />;
}
