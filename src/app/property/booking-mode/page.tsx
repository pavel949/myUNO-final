import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listPropertyCapabilityUnits } from '@/modules/core/property-capability-access';
import { PROPERTY_BOOKING_MODE_LABELS, PROPERTY_BOOKING_MODE_DRAFTS } from '@/modules/content/property-booking-mode.seed';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
export const dynamic = 'force-dynamic';
const WORKSPACE = 'booking-mode' as const;
export default async function BookingModeWorkspacePage() {
  const user = await getCurrentUser(); if (!user) redirect('/login?next=%2Fproperty%2Fbooking-mode');
  const units = await listPropertyCapabilityUnits(prisma, user.identityId, 'booking_mode_editor');
  const labels = await getLabels(PROPERTY_BOOKING_MODE_LABELS, undefined, PROPERTY_BOOKING_MODE_DRAFTS);
  return <main className="stitch-workspace mx-auto max-w-5xl px-16 py-32">
    <PropertyWorkspaceNav identityId={user.identityId} current={WORKSPACE} />
    <h1 className="font-display text-display-xl">{labels['property.booking_mode.title']}</h1>
    <p className="mt-12 text-text-secondary">{labels['property.booking_mode.intro']}</p>
    {!units.length && <p role="status" className="mt-24">{labels['property.booking_mode.empty']}</p>}
    <ul className="mt-24 grid gap-16 sm:grid-cols-2">{units.map(unit => <li key={unit.id} className="stitch-panel p-20">
      <p className="text-small text-text-secondary">{unit.project.name}</p><h2 className="font-semibold">{unit.name}</h2>
      <Link href={`/property/booking-mode/${unit.id}`} className="mt-12 inline-block text-brand-andaman underline">{labels['property.booking_mode.open']}</Link>
    </li>)}</ul>
  </main>;
}
