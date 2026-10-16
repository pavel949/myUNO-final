import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { assertPropertyCapabilityForUnit, PropertyCapabilityError } from '@/modules/core/property-capability-access';
import { PROPERTY_BOOKING_MODE_LABELS, PROPERTY_BOOKING_MODE_DRAFTS } from '@/modules/content/property-booking-mode.seed';
import { COMMERCIAL_LABELS } from '@/components/units/tariff-labels';
import { TARIFF_EDITOR_USABILITY_DRAFTS } from '@/modules/content/tariff-editor-usability.seed';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import BookingModeClient from '@/app/(admin)/app/admin/units/[id]/booking-mode-client';
export const dynamic = 'force-dynamic';
const WORKSPACE = 'booking-mode' as const;
export default async function UnitBookingModePage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser(); if (!user) redirect('/login?next=' + encodeURIComponent('/property/booking-mode/' + params.unitId));
  const access = await assertPropertyCapabilityForUnit(prisma, user.identityId, 'booking_mode_editor', params.unitId).catch(error => {
    if (error instanceof PropertyCapabilityError) notFound(); throw error;
  });
  // A category count is disclosed only if every actual member is in this person's current scope.
  let categoryUnits = 0;
  if (access.unit.inventoryCategoryId) {
    const members = await prisma.unit.findMany({ where: { inventoryCategoryId: access.unit.inventoryCategoryId, status: { not: 'offboarded' } }, select: { id: true } });
    let allowed = members.length <= 500;
    for (const member of members) {
      if (!allowed) break;
      try { await assertPropertyCapabilityForUnit(prisma, user.identityId, 'booking_mode_editor', member.id); }
      catch (error) { if (error instanceof PropertyCapabilityError) allowed = false; else throw error; }
    }
    if (allowed) categoryUnits = members.length;
  }
  const labels = await getLabels({ ...COMMERCIAL_LABELS, ...PROPERTY_BOOKING_MODE_LABELS }, undefined,
    { ...TARIFF_EDITOR_USABILITY_DRAFTS, ...PROPERTY_BOOKING_MODE_DRAFTS });
  return <main className="stitch-workspace mx-auto max-w-5xl px-16 py-32">
    <PropertyWorkspaceNav identityId={user.identityId} current={WORKSPACE} />
    <Link href="/property/booking-mode" className="text-brand-andaman underline">{labels['property.booking_mode.back']}</Link>
    <h1 className="mt-12 font-display text-display-xl">{access.unit.name}</h1>
    <BookingModeClient unitId={access.unit.id} instantBook={access.unit.instantBook} categoryUnits={categoryUnits} labels={labels} />
  </main>;
}
