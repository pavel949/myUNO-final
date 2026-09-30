import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import ProjectTeamClient from './team-client';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ProjectTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/team');
  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId }, select: { isAdmin: true, status: true },
  });
  if (!identity || identity.status !== 'active') redirect('/');
  const grants = identity.isAdmin ? [] : await prisma.roleAssignment.findMany({
    where: { identityId: user.identityId, role: 'staff_ops', scopeType: 'project', status: 'active', projectId: { not: null } },
    select: { projectId: true },
  });
  const projects = await prisma.project.findMany({
    where: identity.isAdmin ? {} : { id: { in: grants.map(g => g.projectId!).filter(Boolean) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (!projects.length) redirect('/ops');
  const labels = await getLabels({
    'ops.team.back': '← Operations',
    'ops.team.title': 'Project team',
    'ops.team.description': 'Assign existing myUNO users as onsite hosts only in your authorized projects. Platform roles, financial access and management mandates remain administrator-controlled.',
    'ops.team.advanced': 'Invite new people or manage advanced permissions →',
    'ops.team.project': 'Managed project',
    'ops.team.email': "Existing user's email",
    'ops.team.assign': 'Assign onsite host',
    'ops.team.invite_note': 'The person must have an active myUNO account. New invitations are administered in People & Roles.',
    'ops.team.members': 'Onsite hosts for this project',
    'ops.team.loading': 'Refreshing…',
    'ops.team.empty': 'No onsite hosts assigned yet.',
    'ops.team.revoke': 'Revoke project role',
    'ops.team.admin_managed': 'Admin-managed access',
    'ops.team.assigned': 'Onsite host access assigned.',
    'ops.team.revoked': 'Project access revoked.',
  });
  return <main className="min-h-screen bg-surface-ivory px-16 py-32 md:px-32">
    <div className="mx-auto max-w-4xl">
      <Link href="/ops" className="text-brand-andaman">{labels['ops.team.back']}</Link>
      <h1 className="mt-12 font-display text-display-xl text-text-ink">{labels['ops.team.title']}</h1>
      <p className="mt-8 text-text-secondary">{labels['ops.team.description']}</p>
      <ProjectTeamClient projects={projects} labels={labels} />
      {identity.isAdmin && <Link href="/app/admin/people" className="mt-16 inline-block text-brand-andaman underline">{labels['ops.team.advanced']}</Link>}
    </div>
  </main>;
}
