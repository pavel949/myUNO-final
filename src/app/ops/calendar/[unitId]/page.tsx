import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectStaffAccess } from '@/app/libs/projectScope';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import UnitIntegrationHealthStrip from '@/components/units/UnitIntegrationHealthStrip';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { listIntegrationAccounts } from '@/modules/integrations';

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

  const [labels, locale, integrationAccounts] = await Promise.all([
    getLabels({
      'staff.ops.calendar.back': '← Ops board',
      'staff.ops.calendar.title': 'Unit calendar',
      'staff.ops.calendar.subtitle': 'Block dates or set one-off rates for this unit.',
      ...UNIT_CALENDAR_LABEL_KEYS,
    }),
    getRequestLocale(),
    listIntegrationAccounts(prisma, 'unit', unit.id),
  ]);

  return (
    <main className="min-h-screen bg-surface-background">
      <section className="max-w-4xl mx-auto px-24 py-32">
        <Link href="/ops" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['staff.ops.calendar.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12">
          {unit.name} · {labels['staff.ops.calendar.title']}
        </h1>
        <p className="text-body text-text-secondary mt-8">
          {unit.project.name} — {labels['staff.ops.calendar.subtitle']}
        </p>
        <div className="mt-24">
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
