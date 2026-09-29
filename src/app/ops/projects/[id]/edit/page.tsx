/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import ProjectFactsForm from './project-facts-form';
export const dynamic = 'force-dynamic';
export default async function EditProjectFactsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops');
  const assigned = await prisma.roleAssignment.findFirst({
    where: { identityId: user.identityId, role: 'staff_ops', scopeType: 'project', status: 'active', projectId: params.id },
    select: { id: true },
  });
  if (!user.isAdmin && !assigned) notFound();
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: {
    id: true, name: true, brand: true, address: true, city: true, district: true,
    projectType: true, totalUnits: true, facilities: true, status: true,
  } });
  if (!project) notFound();
  return <main className="min-h-screen bg-surface-ivory px-16 py-32 md:px-32"><div className="mx-auto max-w-4xl">
    <Link href="/mc/portfolio" className="text-brand-andaman">← Portfolio calendar</Link>
    <h1 className="mt-12 font-display text-display-xl text-text-ink">Edit {project.name}</h1><p className="mt-8 text-text-secondary">Shared complex / resort record · {project.status}</p>
    <ProjectFactsForm project={project}/>
  </div></main>;
}
