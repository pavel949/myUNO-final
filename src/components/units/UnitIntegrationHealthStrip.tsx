import type { IntegrationKey, IntegrationStatus } from '@prisma/client';

export interface UnitIntegrationAccount {
  integrationKey: IntegrationKey;
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
}

const ICAL_KEYS = new Set<IntegrationKey>(['ical_airbnb', 'ical_booking', 'ical_agoda']);

export default function UnitIntegrationHealthStrip({
  accounts,
  labels,
  locale,
}: {
  accounts: UnitIntegrationAccount[];
  labels: Record<string, string>;
  locale: string;
}) {
  const icalAccounts = accounts.filter((account) => ICAL_KEYS.has(account.integrationKey));
  if (icalAccounts.length === 0) {
    return null;
  }

  const statusStyle: Record<IntegrationStatus, string> = {
    active: 'bg-state-success-soft text-state-success',
    error: 'bg-state-error-soft text-state-error',
    disabled: 'bg-surface-ivory text-text-stone',
  };

  return (
    <section className="mb-24 bg-surface-paper border border-border-line rounded-lg p-20">
      <h2 className="text-heading-3 font-semibold text-text-ink mb-12">
        {labels['staff.calendar.integrations_title']}
      </h2>
      <ul className="space-y-12">
        {icalAccounts.map((account) => (
          <li
            key={account.integrationKey}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 border-b border-border-line last:border-b-0 pb-12 last:pb-0"
          >
            <div>
              <p className="text-body font-medium text-text-ink">
                {labels[`integrations.key.${account.integrationKey}`] || account.integrationKey}
              </p>
              <p className="text-small text-text-secondary">
                {labels['staff.calendar.integrations_last_sync']}:{' '}
                {account.lastSyncAt
                  ? new Date(account.lastSyncAt).toLocaleString(locale)
                  : labels['staff.calendar.integrations_never']}
              </p>
              {account.lastError ? (
                <p className="text-small text-state-error mt-4">{account.lastError}</p>
              ) : null}
            </div>
            <span
              className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                statusStyle[account.status]
              }`}
            >
              {labels[`integrations.status.${account.status}`] || account.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
