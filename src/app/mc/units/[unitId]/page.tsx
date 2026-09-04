import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MCUnitCalendarPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/mc/units/${params.unitId}`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });
  if (!unit) {
    notFound();
  }

  const allowed = await hasManagedUnitMcAccess(user, {
    projectId: unit.projectId,
    unitId: unit.id,
  });
  if (!allowed) {
    notFound();
  }

  const labels = await getLabels({
    'mc.units.calendar.back': '← MC portal',
    'mc.units.calendar.title': 'Availability & pricing',
    'mc.units.calendar.subtitle': 'Manage calendar blocks and one-off rates for this unit.',
    'staff.calendar.title': 'Availability & pricing',
    'staff.calendar.intro':
      'Block this unit for maintenance or an owner stay, or set a one-off rate for a date range.',
    'staff.calendar.loading': 'Loading…',
    'staff.calendar.error_generic': 'Something went wrong. Please try again.',
    'staff.calendar.saving': 'Saving…',
    'staff.calendar.blocks_title': 'Blocked dates',
    'staff.calendar.blocks_none': 'No blocked dates.',
    'staff.calendar.reason.maintenance': 'Maintenance',
    'staff.calendar.reason.owner_hold': 'Owner hold',
    'staff.calendar.reason.other': 'Other',
    'staff.calendar.start_date': 'Start date',
    'staff.calendar.end_date': 'End date',
    'staff.calendar.reason_field': 'Reason',
    'staff.calendar.note': 'Note (optional)',
    'staff.calendar.add_block': 'Block these dates',
    'staff.calendar.remove': 'Remove',
    'staff.calendar.pricing_title': 'Pricing overrides',
    'staff.calendar.pricing_none': 'No pricing overrides.',
    'staff.calendar.per_night': '/night',
    'staff.calendar.nightly_rate': 'Nightly rate (THB)',
    'staff.calendar.label': 'Label (optional)',
    'staff.calendar.add_rule': 'Add rate',
  });

  return (
    <main className="min-h-screen bg-surface-background">
      <section className="max-w-4xl mx-auto px-24 py-32">
        <Link href="/mc" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.units.calendar.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12">
          {unit.name} · {labels['mc.units.calendar.title']}
        </h1>
        <p className="text-body text-text-secondary mt-8">
          {unit.project.name} — {labels['mc.units.calendar.subtitle']}
        </p>
        <div className="mt-24">
          <AvailabilityPricingPanel unitId={unit.id} labels={labels} />
        </div>
      </section>
    </main>
  );
}
