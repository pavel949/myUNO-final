import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import PropertySubmissionWizard from './wizard';

export const dynamic = 'force-dynamic';
export default async function PropertyOnboardPage({ searchParams }: { searchParams?: { projectId?: string; offers?: string; kind?: string; operatingModel?: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    const query = typeof searchParams?.projectId === 'string' ? `?projectId=${encodeURIComponent(searchParams.projectId)}` : '';
    redirect(`/login?next=${encodeURIComponent('/property/onboard' + query)}`);
  }
  const scopedIds = user.roles.map(role => role.projectId).filter((id): id is string => Boolean(id));
  const [projects, areas] = await Promise.all([prisma.project.findMany({
    where: user.isAdmin ? { status: { not: 'archived' } } : { OR: [{ status: 'live' }, { id: { in: scopedIds }, status: 'draft' }] }, orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true },
    take: 500,
  }), prisma.area.findMany({ where: { status: 'live' }, select: { id: true, slug: true }, orderBy: { sort: 'asc' } })]);
  const initialProjectId = projects.some(project => project.id === searchParams?.projectId) ? searchParams?.projectId : undefined;
  const allowedOffers = new Set(['short_stay', 'monthly', 'yearly', 'sale']);
  const initialOffers = (searchParams?.offers || '').split(',').filter((offer) => allowedOffers.has(offer));
  const initialKind = ['home', 'resort', 'management'].includes(searchParams?.kind || '') ? searchParams?.kind : undefined;
  const initialOperatingModel = ['owner_direct', 'via_management_company', 'direct_managed'].includes(searchParams?.operatingModel || '')
    ? searchParams?.operatingModel
    : undefined;
  return <PropertySubmissionWizard
    projects={projects}
    areas={areas}
    initialProjectId={initialProjectId}
    initialOffers={initialOffers}
    initialKind={initialKind}
    initialOperatingModel={initialOperatingModel}
  />;
}
