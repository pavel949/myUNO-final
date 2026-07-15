import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getIntegrationHealth } from '@/app/actions/getIntegrationHealth';
import { IntegrationHealthPanel } from '@/app/components/admin/IntegrationHealthPanel';
import { prisma } from '@/lib/prisma';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();

  if (!user?.identityId) {
    redirect('/auth/login');
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

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Integration Health</h1>
        <p className="text-gray-600 mt-2">
          Monitor all OTA channel synchronizations (iCal exports, imports, conflict status)
        </p>
      </div>

      <IntegrationHealthPanel accounts={accounts} total={total} />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">About Integrations</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Active</strong> — Last sync succeeded; calendar data is synchronized
          </li>
          <li>
            <strong>Error</strong> — Last sync failed; check error message and retry via cron
          </li>
          <li>
            <strong>Disabled</strong> — Integration manually disabled; no syncs will occur
          </li>
          <li>Per-unit iCal export available at <code className="bg-white px-1 rounded">/api/units/[unitId]/ical/export</code></li>
          <li>Conflict detection active — OTA bookings overlapping platform bookings are logged</li>
        </ul>
      </div>
    </div>
  );
}
