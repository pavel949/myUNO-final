import Link from 'next/link';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { PROPERTY_LISTINGS_KEYS, PROPERTY_LISTINGS_LOCALE_DRAFTS } from '@/modules/content/property-listings.seed';
import { StitchMain, PageHeading, LinkButton } from '@/components/premium/StitchPage';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { hasSelfListingAccess } from '@/app/libs/supplierListingAccess';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
export const dynamic = 'force-dynamic';
export default async function SupplierListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fproperty%2Flistings');
  const locale = getRequestLocale();
  const labels = await getLabels(Object.fromEntries(PROPERTY_LISTINGS_KEYS.map(entry => [entry.key, entry.en])), locale, PROPERTY_LISTINGS_LOCALE_DRAFTS);
  const organizationIds = user.roles.filter(role => role.role === 'mc_member').map(role => role.organizationId).filter((id): id is string => Boolean(id));
  const [drafts, units] = await Promise.all([
    prisma.crmOpportunity.findMany({ where: { identityId: user.identityId, source: 'myuno_property_submission_v1' }, select: { id: true, title: true, requirements: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.unit.findMany({ where: { OR: [{ ownerIdentityId: user.identityId }, { engagements: { some: { status: 'active', engagementType: 'via_management_company', managementOrgId: { in: organizationIds } } } }] }, select: { id: true, name: true, projectId: true }, take: 100 }),
  ]);
  const editable = (await Promise.all(units.map(async unit => ({ ...unit, allowed: await hasSelfListingAccess(user.identityId, unit.id) || await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id }) })))).filter(unit => unit.allowed);
  return <StitchMain>
    <PageHeading title={labels['property.listings.title']} />
    <p className="mt-12 text-text-secondary">{labels['property.listings.intro']}</p>
    <div className="mt-20 flex flex-wrap gap-12"><LinkButton href="/property/onboard?kind=home&offers=short_stay,monthly,yearly">{labels['property.listings.create']}</LinkButton><LinkButton variant="secondary" href="/manage">{labels['property.listings.management']}</LinkButton></div>
    <section className="stitch-panel p-20 md:p-24"><h2 className="font-display text-heading-2">{labels['property.listings.applications']}</h2>{!drafts.length && <p className="mt-12">{labels['property.listings.empty']}</p>}{drafts.map(draft => {
      const data = draft.requirements as Record<string, unknown>;
      return <Link key={draft.id} href={'/property/onboard?submissionId=' + draft.id} className="stitch-panel mt-12 block p-16">{draft.title} · {labels[`property.listings.status.${typeof data.status === 'string' ? data.status : 'draft'}`] || labels['property.listings.status.unknown']}</Link>;
    })}</section>
    <section className="stitch-panel p-20 md:p-24"><h2 className="font-display text-heading-2">{labels['property.listings.settings']}</h2>{!editable.length && <p className="mt-12 text-text-secondary">{labels['property.listings.settings_empty']}</p>}{editable.map(unit => <Link key={unit.id} href={'/property/listings/' + unit.id} className="stitch-panel mt-12 block p-16">{unit.name} →</Link>)}</section>
  </StitchMain>;
}
