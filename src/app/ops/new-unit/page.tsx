/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import ManagerUnitForm from './manager-unit-form';
export const dynamic = 'force-dynamic';

export default async function NewManagedUnitPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/new-unit');
  const roles = await prisma.roleAssignment.findMany({
    where: { identityId: user.identityId, status: 'active', role: 'staff_ops', scopeType: 'project', projectId: { not: null } },
    select: { projectId: true },
  });
  const projectIds = [...new Set(roles.map((r) => r.projectId).filter((id): id is string => !!id))];
  if (!user.isAdmin && !projectIds.length) redirect('/');
  const projects = await prisma.project.findMany({
    where: user.isAdmin ? {} : { id: { in: projectIds } },
    select: { id: true, name: true, inventoryCategories: { select: { id: true, name: true, bedrooms: true, bathrooms: true, maxGuests: true, baseNightlyThb: true } } },
    orderBy: { name: 'asc' },
  });
  return <main className="stitch-workspace px-16 py-32 md:px-32"><div className="mx-auto max-w-4xl"><Link className="text-brand-andaman" href="/ops">← Operations</Link><h1 className="mt-12 font-display text-display-xl text-text-ink">Add managed property</h1><p className="mt-8 text-text-secondary">Choose an existing complex and its canonical inventory category. The new physical unit stays draft until the mandate and activation checks are complete.</p><ManagerUnitForm projects={projects.map(({ id, name, inventoryCategories }) => ({ id, name, categories: inventoryCategories }))}/></div></main>;
}
