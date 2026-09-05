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
      <div className="py-24 text-center">
        <p className="text-body text-text-secondary">{labels['admin.integrations.empty']}</p>
      </div>
    );
  }

  const integrationLabel = (key: IntegrationKey) => labels[`integrations.key.${key}`] || key;

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
      <h2 className="font-display text-heading-3 text-brand-deep">
        {fill(labels['admin.integrations.table_title'], { total })}
      </h2>

      <div className="grid gap-16 md:grid-cols-2">
        {accounts.map((account) => (
          <article
            key={account.id}
            className="rounded-lg border border-border-line bg-surface-paper p-20 shadow-card"
          >
            <div className="flex items-start justify-between gap-12">
              <div>
                <p className="text-body font-medium text-text-ink">
                  {integrationLabel(account.integrationKey)}
                </p>
                <p className="mt-4 text-small text-text-secondary">{scopeLabel(account)}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-10 py-4 text-small font-medium ${
                  STATUS_STYLE[account.status]
                }`}
              >
                {statusLabel(account.status)}
              </span>
            </div>
            <dl className="mt-16 space-y-8 text-small">
              <div className="flex justify-between gap-12">
                <dt className="text-text-secondary">{labels['admin.integrations.col_last_sync']}</dt>
                <dd className="text-text-ink">
                  {account.lastSyncAt
                    ? new Date(account.lastSyncAt).toLocaleString(locale)
                    : labels['admin.integrations.never_synced']}
                </dd>
              </div>
              {account.lastError ? (
                <div>
                  <dt className="text-text-secondary">{labels['admin.integrations.col_error']}</dt>
                  <dd className="mt-4 text-state-error">{account.lastError}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
