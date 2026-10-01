/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectStaffAccess } from '@/app/libs/projectScope';
import { opsHref } from '@/app/libs/opsProjectContext';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import UnitAccessEditor from '@/components/units/UnitAccessEditor';
import UnitIntegrationHealthStrip from '@/components/units/UnitIntegrationHealthStrip';
import UnitIcalConflictBanner, { UNIT_ICAL_CALENDAR_SURFACES } from '@/components/units/UnitIcalConflictBanner';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getUnitIcalConflictAlerts, listIntegrationAccounts } from '@/modules/integrations';

export const dynamic = 'force-dynamic';

export default async function OpsUnitCalendarPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/ops/calendar/${params.unitId}`);
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

  if (!hasProjectStaffAccess(user, unit.projectId)) {
    notFound();
  }

  const [labels, locale, integrationAccounts, conflictAlerts] = await Promise.all([
    getLabels({
      'staff.ops.calendar.back': '← Ops board',
      'staff.ops.calendar.title': 'Unit calendar',
      'staff.ops.calendar.subtitle': 'Use the portfolio calendar for occupancy. Manage unit blocks, prices and integrations below.',
      'staff.ops.calendar.occupancy': 'View in unified calendar →',
      ...UNIT_CALENDAR_LABEL_KEYS,
    }),
    getRequestLocale(),
    listIntegrationAccounts(prisma, 'unit', unit.id),
    getUnitIcalConflictAlerts(prisma, unit.id),
  ]);

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="max-w-4xl mx-auto px-24 py-32">
        <Link
          href={opsHref('/ops/calendar', unit.projectId)}
          className="text-small font-semibold text-brand-andaman hover:underline"
        >
          {labels['staff.ops.calendar.back']}
        </Link>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mt-12">
          {unit.name} · {labels['staff.ops.calendar.title']}
        </h1>
        <p className="text-body text-text-stone mt-8">
          {unit.project.name} — {labels['staff.ops.calendar.subtitle']}
        </p>
        <div className="mt-16">
          <Link href={'/ops/calendar/board?projectId='+unit.projectId+'&unitId='+unit.id} className="inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
            {labels['staff.ops.calendar.occupancy']}
          </Link>
        </div>
        <Link href={`/ops/units/${unit.id}/edit`} className="mt-16 inline-flex rounded-md border border-border-line bg-surface-paper px-16 py-10 text-small font-semibold text-brand-andaman">Edit property facts →</Link>
        <div className="mt-24">
          <UnitIcalConflictBanner
            conflicts={conflictAlerts}
            labels={labels}
            calendarSurface={UNIT_ICAL_CALENDAR_SURFACES.none}
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
          <UnitAccessEditor unitId={unit.id} />
        </div>
      </section>
    </main>
  );
}
