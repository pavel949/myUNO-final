'use client';

import { IntegrationAccountHealth } from '@/app/actions/getIntegrationHealth';
import { IntegrationStatus, IntegrationKey } from '@prisma/client';

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

const STATUS_STYLE: Record<IntegrationStatus, string> = {
  active: 'bg-state-success-soft text-state-success',
  error: 'bg-state-error-soft text-state-error',
  disabled: 'bg-surface-ivory text-text-stone',
};

export function IntegrationHealthPanel({
  accounts,
  total,
  labels,
  locale,
}: {
  accounts: IntegrationAccountHealth[];
  total: number;
  labels: Record<string, string>;
  locale: string;
}) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-body text-text-secondary">{labels['admin.integrations.empty']}</p>
      </div>
    );
  }

  const integrationLabel = (key: IntegrationKey) =>
    labels[`integrations.key.${key}`] || key;

  const statusLabel = (status: IntegrationStatus) =>
    labels[`integrations.status.${status}`] || status;

  const scopeLabel = (account: IntegrationAccountHealth) => {
    if (account.unit) {
      return fill(labels['admin.integrations.scope_unit'], { name: account.unit.name });
    }
    if (account.project) {
      return fill(labels['admin.integrations.scope_project'], { name: account.project.name });
    }
    return labels['admin.integrations.scope_platform'];
  };

  return (
    <div className="space-y-16">
      <h2 className="text-heading-3 font-semibold text-text-ink">
        {fill(labels['admin.integrations.table_title'], { total })}
      </h2>

      <div className="overflow-x-auto bg-surface-paper border border-border-line rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-line bg-surface-ivory">
              <th className="text-left py-12 px-16 font-semibold text-text-ink text-small">
                {labels['admin.integrations.col_integration']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-ink text-small">
                {labels['admin.integrations.col_scope']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-ink text-small">
                {labels['admin.integrations.col_status']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-ink text-small">
                {labels['admin.integrations.col_last_sync']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-ink text-small">
                {labels['admin.integrations.col_error']}
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="border-b border-border-line last:border-b-0 hover:bg-surface-ivory"
              >
                <td className="py-12 px-16">
                  <span className="text-body font-medium text-text-ink">
                    {integrationLabel(account.integrationKey)}
                  </span>
                </td>
                <td className="py-12 px-16">
                  <span className="text-small text-text-secondary">{scopeLabel(account)}</span>
                </td>
                <td className="py-12 px-16">
                  <span
                    className={`inline-flex items-center px-10 py-4 rounded-full text-small font-medium ${
                      STATUS_STYLE[account.status]
                    }`}
                  >
                    {statusLabel(account.status)}
                  </span>
                </td>
                <td className="py-12 px-16">
                  <span className="text-small text-text-secondary">
                    {account.lastSyncAt
                      ? new Date(account.lastSyncAt).toLocaleString(locale)
                      : labels['admin.integrations.never_synced']}
                  </span>
                </td>
                <td className="py-12 px-16">
                  <span className="text-small text-state-error">
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
