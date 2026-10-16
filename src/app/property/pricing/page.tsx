import Link from 'next/link';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listPricingUnits, PricingAccessError } from '@/modules/core/pricing-access';
import { PRICING_WORKSPACE_LABELS, PRICING_WORKSPACE_DRAFTS } from '@/modules/content/pricing-workspace.seed';

const CURRENT_WORKSPACE = 'pricing';
export const dynamic = 'force-dynamic';
export default async function PricingWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/property/pricing');
  const units = await listPricingUnits(prisma, user.identityId).catch(error => {
    if (error instanceof PricingAccessError) return [];
    throw error;
  });
  const labels = await getLabels(PRICING_WORKSPACE_LABELS, undefined, PRICING_WORKSPACE_DRAFTS);
  return <main className="stitch-workspace mx-auto max-w-5xl px-16 py-32">
    <PropertyWorkspaceNav identityId={user.identityId} current={CURRENT_WORKSPACE} />
    <h1 className="font-display text-display-xl text-text-ink">{labels['pricing.workspace.title']}</h1>
    <p className="mt-12 text-text-secondary">{labels['pricing.workspace.intro']}</p>
    {!units.length && <p className="mt-24" role="status">{labels['pricing.workspace.empty']}</p>}
    <ul className="mt-24 grid gap-12 sm:grid-cols-2">{units.map(unit => <li key={unit.id} className="stitch-panel p-20">
      <p className="text-small text-text-secondary">{unit.project.name}</p><h2 className="font-semibold">{unit.name}</h2>
      <Link className="mt-12 inline-block text-brand-andaman underline" href={`/property/pricing/${unit.id}`}>{labels['pricing.workspace.open']}</Link>
    </li>)}</ul>
  </main>;
}
