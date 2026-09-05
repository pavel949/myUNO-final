'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface ProspectingRow {
  id: string;
  identityName: string;
  identityEmail: string | null;
  accountType: string;
  status: string;
  reasonForContact: string | null;
  priority: number;
  assignedToName: string | null;
  expectedCloseAt: string | null;
}

type Labels = Record<string, string>;

const STATUS_GROUPS = [
  { key: 'active', statuses: 'new,contacted,interested,pitched', labelKey: 'admin.prospecting.filter_active' },
  { key: 'new', statuses: 'new', labelKey: 'admin.prospecting.filter_new' },
  { key: 'contacted', statuses: 'contacted', labelKey: 'admin.prospecting.filter_contacted' },
  { key: 'interested', statuses: 'interested,pitched', labelKey: 'admin.prospecting.filter_interested' },
  { key: 'closed', statuses: 'closed', labelKey: 'admin.prospecting.filter_closed' },
] as const;

const NEXT_STATUS: Record<string, string | null> = {
  new: 'contacted',
  contacted: 'interested',
  interested: 'pitched',
  pitched: 'closed',
  closed: null,
};

function mapAccount(raw: Record<string, unknown>): ProspectingRow {
  const assignedTo = raw.assignedTo as { name?: string } | null;
  return {
    id: String(raw.id),
    identityName: String(raw.identityName || '—'),
    identityEmail: raw.identityEmail ? String(raw.identityEmail) : null,
    accountType: String(raw.accountType),
    status: String(raw.status),
    reasonForContact: raw.reasonForContact ? String(raw.reasonForContact) : null,
    priority: Number(raw.priority ?? 1),
    assignedToName: assignedTo?.name || null,
    expectedCloseAt: raw.expectedCloseAt ? String(raw.expectedCloseAt) : null,
  };
}

export default function AdminProspectingClient({
  labels,
  contacts,
}: {
  labels: Labels;
  contacts: Array<{ id: string; name: string; email: string | null }>;
}) {
  const [activeGroup, setActiveGroup] =
    useState<(typeof STATUS_GROUPS)[number]['key']>('active');
  const [accounts, setAccounts] = useState<ProspectingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    identityId: '',
    accountType: 'owner',
    reasonForContact: '',
    priority: '1',
    expectedCloseAt: '',
  });

  const load = useCallback(
    async (group: (typeof STATUS_GROUPS)[number]['key']) => {
      setLoading(true);
      setError(null);
      const statuses =
        STATUS_GROUPS.find((item) => item.key === group)?.statuses ?? 'new,contacted,interested,pitched';
      try {
        const response = await fetch(
          `/api/admin/prospecting?statuses=${encodeURIComponent(statuses)}`
        );
        if (!response.ok) throw new Error(labels['admin.prospecting.error']);
        const data = await response.json();
        const rows = Array.isArray(data.accounts) ? data.accounts : [];
        setAccounts(rows.map((row: Record<string, unknown>) => mapAccount(row)));
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.prospecting.error']);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    },
    [labels]
  );

  useEffect(() => {
    void load(activeGroup);
  }, [activeGroup, load]);

  const advance = async (accountId: string, status: string) => {
    setBusyId(accountId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/prospecting/${accountId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.prospecting.error']);
      }
      await load(activeGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.prospecting.error']);
    } finally {
      setBusyId(null);
    }
  };

  const createAccount = async () => {
    if (!draft.identityId) return;
    setBusyId('new');
    setError(null);
    try {
      const response = await fetch('/api/admin/prospecting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: draft.identityId,
          accountType: draft.accountType,
          reasonForContact: draft.reasonForContact || undefined,
          priority: Number(draft.priority) || 1,
          expectedCloseAt: draft.expectedCloseAt || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.prospecting.error']);
      }
      setDraft({
        identityId: '',
        accountType: 'owner',
        reasonForContact: '',
        priority: '1',
        expectedCloseAt: '',
      });
      await load(activeGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.prospecting.error']);
    } finally {
      setBusyId(null);
    }
  };

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  const typeLabel = (type: string) => labels[`admin.prospecting.type.${type}`] || type;
  const statusLabel = (status: string) => labels[`admin.prospecting.status.${status}`] || status;

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.prospecting.create_title']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.prospecting.col_contact']}</span>
            <select
              value={draft.identityId}
              onChange={(e) => setDraft((prev) => ({ ...prev, identityId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{labels['admin.prospecting.select_contact']}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.email ? ` (${contact.email})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.prospecting.col_type']}</span>
            <select
              value={draft.accountType}
              onChange={(e) => setDraft((prev) => ({ ...prev, accountType: e.target.value }))}
              className={fieldClass}
            >
              <option value="owner">{labels['admin.prospecting.type.owner']}</option>
              <option value="developer">{labels['admin.prospecting.type.developer']}</option>
              <option value="institutional_partner">
                {labels['admin.prospecting.type.institutional_partner']}
              </option>
            </select>
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.prospecting.col_reason']}</span>
            <input
              type="text"
              value={draft.reasonForContact}
              onChange={(e) => setDraft((prev) => ({ ...prev, reasonForContact: e.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <Button size="sm" onClick={createAccount} isLoading={busyId === 'new'} disabled={!draft.identityId}>
          {labels['admin.prospecting.create_submit']}
        </Button>
      </section>

      <div className="flex flex-wrap gap-8 mb-24">
        {STATUS_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setActiveGroup(group.key)}
            className={
              activeGroup === group.key
                ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                : 'px-12 py-8 rounded-full text-small bg-surface-paper border border-border-line text-text-ink hover:border-brand-andaman'
            }
          >
            {labels[group.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.prospecting.loading']}</p>
      ) : accounts.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.prospecting.empty']}</p>
      ) : (
        <div className="overflow-x-auto border border-border-line rounded-lg">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory border-b border-border-line">
              <tr>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_contact']}</th>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_type']}</th>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_status']}</th>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_reason']}</th>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_close']}</th>
                <th className="p-12 font-semibold">{labels['admin.prospecting.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const next = NEXT_STATUS[account.status];
                return (
                  <tr key={account.id} className="border-b border-border-line last:border-0">
                    <td className="p-12">
                      <div className="text-text-ink font-medium">{account.identityName}</div>
                      {account.identityEmail && (
                        <div className="text-text-secondary">{account.identityEmail}</div>
                      )}
                    </td>
                    <td className="p-12 text-text-secondary">{typeLabel(account.accountType)}</td>
                    <td className="p-12 text-text-secondary">{statusLabel(account.status)}</td>
                    <td className="p-12 text-text-secondary max-w-xs truncate">
                      {account.reasonForContact || '—'}
                    </td>
                    <td className="p-12 text-text-secondary">
                      {account.expectedCloseAt
                        ? new Date(account.expectedCloseAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-12">
                      {next ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyId === account.id}
                          onClick={() => advance(account.id, next)}
                        >
                          {labels[`admin.prospecting.action.${next}`]}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
