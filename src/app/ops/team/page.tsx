import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import ProjectTeamClient from './team-client';

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
  return <main className="min-h-screen bg-surface-ivory px-16 py-32 md:px-32">
    <div className="mx-auto max-w-4xl">
      <Link href="/ops" className="text-brand-andaman">← Operations</Link>
      <h1 className="mt-12 font-display text-display-xl text-text-ink">Project team</h1>
      <p className="mt-8 text-text-secondary">Assign existing myUNO users as onsite hosts only in your authorized projects. Platform roles, financial access and management mandates remain administrator-controlled.</p>
      <ProjectTeamClient projects={projects} />
      {identity.isAdmin && <Link href="/app/admin/people" className="mt-16 inline-block text-brand-andaman underline">Invite new people or manage advanced permissions →</Link>}
    </div>
  </main>;
}
