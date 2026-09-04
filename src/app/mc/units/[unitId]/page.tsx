import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import UnitIntegrationHealthStrip from '@/components/units/UnitIntegrationHealthStrip';
import UnitIcalConflictBanner, { UNIT_ICAL_CALENDAR_SURFACES } from '@/components/units/UnitIcalConflictBanner';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getUnitIcalConflictAlerts, listIntegrationAccounts } from '@/modules/integrations';

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

  const [labels, locale, integrationAccounts, conflictAlerts] = await Promise.all([
    getLabels({
      'mc.units.calendar.back': '← MC portal',
      'mc.units.calendar.title': 'Availability & pricing',
      'mc.units.calendar.subtitle': 'Manage calendar blocks and one-off rates for this unit.',
      ...UNIT_CALENDAR_LABEL_KEYS,
    }),
    getRequestLocale(),
    listIntegrationAccounts(prisma, 'unit', unit.id),
    getUnitIcalConflictAlerts(prisma, unit.id),
  ]);

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
          <UnitIcalConflictBanner
            conflicts={conflictAlerts}
            labels={labels}
            calendarSurface={UNIT_ICAL_CALENDAR_SURFACES.mc}
          />
          <UnitIntegrationHealthStrip
            accounts={integrationAccounts.map((account) => ({
              integrationKey: account.integrationKey,
              status: account.status,
              lastSyncAt: account.lastSyncAt,
              lastError: account.lastError,
            }))}
            labels={labels}
            locale={locale}
          />
          <AvailabilityPricingPanel unitId={unit.id} labels={labels} />
        </div>
      </section>
    </main>
  );
}
