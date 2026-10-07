/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { StitchMain, PageHeading, LinkButton } from '@/components/premium/StitchPage';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasSelfListingAccess } from '@/app/libs/supplierListingAccess';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
export const dynamic = 'force-dynamic';
export default async function SupplierListingPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/property/listings/' + params.unitId)}`);
  const unit = await prisma.unit.findUnique({ where: { id: params.unitId }, select: { id: true, name: true, projectId: true, status: true } });
  if (!unit) notFound();
  const allowed = await hasSelfListingAccess(user.identityId, unit.id) || await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id });
  if (!allowed) notFound();
  const labels = await getLabels(UNIT_CALENDAR_LABEL_KEYS);
  return <StitchMain>
    <Link href="/property/listings" className="text-brand-andaman">← My listings</Link>
    <PageHeading title={unit.name} />
    <p className="mt-12 text-text-secondary">Maintain your property details, photos, dated prices and unavailable dates. myUNO reviews publication and remains the guest booking and support contact. These settings do not grant publication or booking authority.</p>
    <LinkButton variant="secondary" href={`/ops/units/${unit.id}/edit`}>Edit details and photos →</LinkButton>
    <AvailabilityPricingPanel unitId={unit.id} labels={labels} />
  </StitchMain>;
}
