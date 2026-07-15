'use client';

import { IntegrationAccountHealth } from '@/app/actions/getIntegrationHealth';
import { IntegrationStatus, IntegrationKey } from '@prisma/client';

const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  ical_airbnb: 'iCal - Airbnb',
  ical_booking: 'iCal - Booking.com',
  ical_agoda: 'iCal - Agoda',
  payment_provider: 'Payment Provider',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  crm_hubspot: 'HubSpot CRM',
};

const STATUS_COLORS: Record<IntegrationStatus, string> = {
  active: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  disabled: 'bg-gray-100 text-gray-700',
};

export function IntegrationHealthPanel({
  accounts,
  total,
}: {
  accounts: IntegrationAccountHealth[];
  total: number;
}) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No integration accounts configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Integration Health ({total})
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Integration
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Scope
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Status
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Last Sync
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Error
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="text-sm font-medium">
                    {INTEGRATION_LABELS[account.integrationKey]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-600">
                    {account.unit ? `Unit: ${account.unit.name}` :
                     account.project ? `Project: ${account.project.name}` :
                     'Platform'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${
                      STATUS_COLORS[account.status]
                    }`}
                  >
                    {account.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-600">
                    {account.lastSyncAt
                      ? new Date(account.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-red-600">
                    {account.lastError || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
