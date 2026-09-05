import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getIntegrationHealth } from '@/app/actions/getIntegrationHealth';
import { IntegrationHealthPanel } from '@/app/components/admin/IntegrationHealthPanel';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();

  if (!user?.identityId) {
    redirect('/login');
  }

  // Check admin access
  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true },
  });

  if (!identity?.isAdmin) {
    redirect('/');
  }

  const { accounts, total } = await getIntegrationHealth();
  const locale = getRequestLocale();

  const labels = await getLabels({
    'admin.integrations.title': 'Integration Health',
    'admin.integrations.subtitle':
      'Monitor all OTA channel synchronizations (iCal exports, imports, conflict status)',
    'admin.integrations.empty': 'No integration accounts configured',
    'admin.integrations.table_title': 'Integration health ({total})',
    'admin.integrations.col_integration': 'Integration',
    'admin.integrations.col_scope': 'Scope',
    'admin.integrations.col_status': 'Status',
    'admin.integrations.col_last_sync': 'Last sync',
    'admin.integrations.col_error': 'Error',
    'admin.integrations.scope_unit': 'Unit: {name}',
    'admin.integrations.scope_project': 'Project: {name}',
    'admin.integrations.scope_platform': 'Platform',
    'admin.integrations.never_synced': 'Never',
    'integrations.key.ical_airbnb': 'Airbnb iCal',
    'integrations.key.ical_booking': 'Booking.com iCal',
    'integrations.key.ical_agoda': 'Agoda iCal',
    'integrations.key.payment_provider': 'Payment provider',
    'integrations.key.whatsapp': 'WhatsApp',
    'integrations.key.telegram': 'Telegram',
    'integrations.key.crm_hubspot': 'HubSpot CRM',
    'integrations.status.active': 'Active',
    'integrations.status.error': 'Error',
    'integrations.status.disabled': 'Disabled',
    'admin.integrations.about': 'About Integrations',
    'admin.integrations.about_active': 'Active — last sync succeeded; calendar data is synchronized',
    'admin.integrations.about_error': 'Error — last sync failed; check the error message and retry via cron',
    'admin.integrations.about_disabled': 'Disabled — integration manually disabled; no syncs will occur',
    'admin.integrations.about_export':
      'Per-unit iCal export is at /api/units/[unitId]/ical/export and requires the unit’s feed token in the URL. Treat that link as a secret — anyone holding it can read the unit’s availability.',
    'admin.integrations.about_conflicts':
      'Conflict detection is active — OTA bookings overlapping platform bookings are logged',
  });

  return (
    <div className="space-y-32">
      <div>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
          {labels['admin.integrations.title']}
        </h1>
        <p className="text-body text-text-secondary">
          {labels['admin.integrations.subtitle']}
        </p>
      </div>

      <IntegrationHealthPanel accounts={accounts} total={total} labels={labels} locale={locale} />

      <div className="bg-state-info-soft border border-border-line rounded-lg p-16 text-small text-text-ink">
        <p className="font-semibold mb-8">{labels['admin.integrations.about']}</p>
        <ul className="list-disc list-inside space-y-4">
          <li>{labels['admin.integrations.about_active']}</li>
          <li>{labels['admin.integrations.about_error']}</li>
          <li>{labels['admin.integrations.about_disabled']}</li>
          <li>{labels['admin.integrations.about_export']}</li>
          <li>{labels['admin.integrations.about_conflicts']}</li>
        </ul>
      </div>
    </div>
  );
}
