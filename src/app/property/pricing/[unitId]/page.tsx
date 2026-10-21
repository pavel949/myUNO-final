import Link from 'next/link';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { assertUnitPricingAccess, PricingAccessError } from '@/modules/core/pricing-access';
import { COMMERCIAL_LABELS, TARIFF_PREVIEW_LABELS, tariffPreviewLabels } from '@/components/units/tariff-labels';
import { TARIFF_EDITOR_USABILITY_DRAFTS } from '@/modules/content/tariff-editor-usability.seed';
import { PRICING_WORKSPACE_LABELS, PRICING_WORKSPACE_DRAFTS } from '@/modules/content/pricing-workspace.seed';
import TariffEditorClient from '@/app/(admin)/app/admin/units/[id]/tariff-editor-client';
import TariffPreviewClient from '@/app/(admin)/app/admin/units/[id]/tariff-preview-client';

const CURRENT_WORKSPACE = 'pricing';
export const dynamic = 'force-dynamic';
export default async function UnitPricingPage(props: { params: Promise<{ unitId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/property/pricing/' + params.unitId));
  const access = await assertUnitPricingAccess(prisma, user.identityId, params.unitId).catch(error => {
    if (error instanceof PricingAccessError) notFound();
    throw error;
  });
  const labels = await getLabels({ ...COMMERCIAL_LABELS, ...TARIFF_PREVIEW_LABELS, ...PRICING_WORKSPACE_LABELS },
    undefined, { ...TARIFF_EDITOR_USABILITY_DRAFTS, ...PRICING_WORKSPACE_DRAFTS });
  return <main className="stitch-workspace mx-auto max-w-5xl px-16 py-32">
    <PropertyWorkspaceNav identityId={user.identityId} current={CURRENT_WORKSPACE} />
    <Link href="/property/pricing" className="text-brand-andaman underline">{labels['pricing.workspace.back']}</Link>
    <h1 className="mt-12 font-display text-display-xl text-text-ink">{access.unit.name}</h1>
    <TariffEditorClient unitId={access.unit.id} labels={labels} />
    <TariffPreviewClient unitId={access.unit.id} labels={tariffPreviewLabels(labels)} />
  </main>;
}
