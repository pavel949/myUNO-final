import { getLabels, getRequestLocale } from '@/lib/i18n';
import { PROPERTY_ONBOARDING_KEYS, PROPERTY_ONBOARDING_LOCALE_DRAFTS } from '@/modules/content/property-onboarding.seed';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import PropertySubmissionWizard from './wizard';

export const dynamic = 'force-dynamic';
export default async function PropertyOnboardPage({ searchParams }: { searchParams?: { projectId?: string; offers?: string; kind?: string; operatingModel?: string; submissionId?: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams();
    if (typeof searchParams?.submissionId === 'string') params.set('submissionId', searchParams.submissionId);
    if (typeof searchParams?.projectId === 'string') params.set('projectId', searchParams.projectId);
    if (typeof searchParams?.offers === 'string') params.set('offers', searchParams.offers);
    if (typeof searchParams?.kind === 'string') params.set('kind', searchParams.kind);
    if (typeof searchParams?.operatingModel === 'string') params.set('operatingModel', searchParams.operatingModel);
    const query = params.toString() ? `?${params.toString()}` : '';
    redirect(`/login?next=${encodeURIComponent('/property/onboard' + query)}`);
  }
  const locale = getRequestLocale();
  const labels = await getLabels(Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row.en])), locale, PROPERTY_ONBOARDING_LOCALE_DRAFTS);
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
    labels={labels}
    projects={projects}
    areas={areas}
    initialSubmissionId={searchParams?.submissionId}
    initialProjectId={initialProjectId}
    initialOffers={initialOffers}
    initialKind={initialKind}
    initialOperatingModel={initialOperatingModel}
  />;
}
