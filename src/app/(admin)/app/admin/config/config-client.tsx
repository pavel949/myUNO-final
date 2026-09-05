'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface ConfigChangeRow {
  id: string;
  parameterKey: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  changedBy: { firstName: string; lastName: string; email: string | null } | null;
}

type Labels = Record<string, string>;

export default function ConfigAdminClient({
  projectId,
  projects,
  values,
  overridden,
  editableKeys,
  labels,
}: {
  projectId: string;
  projects: { id: string; name: string }[];
  values: Record<string, unknown>;
  overridden: Record<string, boolean>;
  editableKeys: string[];
  labels: Labels;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      editableKeys.map((key) => [
        key,
        typeof values[key] === 'string'
          ? (values[key] as string)
          : JSON.stringify(values[key], null, 2),
      ])
    )
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<ConfigChangeRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (key: string) => {
      setHistoryKey(key);
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(`/api/admin/config/${encodeURIComponent(key)}/history`);
        if (!response.ok) throw new Error(labels['admin.config.history_error']);
        const data = await response.json();
        setHistoryRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setHistoryError(
          err instanceof Error ? err.message : labels['admin.config.history_error']
        );
        setHistoryRows([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [labels]
  );

  const save = async (key: string) => {
    setBusyKey(key);
    setMessages((m) => ({ ...m, [key]: '' }));
    try {
      let newValue: unknown = drafts[key];
      if (key !== 'comms.whatsapp_number') {
        try {
          newValue = JSON.parse(drafts[key]);
        } catch {
          throw new Error(labels['admin.config.error_json']);
        }
      }
      const response = await fetch(`/api/admin/config/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newValue, projectId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['admin.config.error_generic']);
      }
      setMessages((m) => ({ ...m, [key]: labels['admin.config.saved'] }));
      router.refresh();
    } catch (err) {
      setMessages((m) => ({
        ...m,
        [key]: err instanceof Error ? err.message : labels['admin.config.error_generic'],
      }));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-24 max-w-3xl">
      <div>
        <label className="text-small text-text-secondary block mb-4">
          {labels['admin.config.project']}
        </label>
        <select
          className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
          value={projectId}
          onChange={(e) => router.push(`/app/admin/config?projectId=${e.target.value}`)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {editableKeys.map((key) => (
        <div key={key} className="bg-surface-paper border border-border-line rounded-lg p-16">
          <div className="flex items-center justify-between mb-8">
            <p className="text-subtitle font-semibold text-text-ink">
              <code>{key}</code>
            </p>
            <span className="text-small text-text-secondary">
              {overridden[key]
                ? labels['admin.config.overridden']
                : labels['admin.config.inherited']}
            </span>
          </div>
          {key === 'comms.whatsapp_number' ? (
            <input
              className="w-full h-40 px-12 rounded-sm bg-surface-ivory border border-border-line text-small text-text-ink font-mono"
              value={drafts[key]}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
            />
          ) : (
            <textarea
              className="w-full min-h-[160px] p-12 rounded-sm bg-surface-ivory border border-border-line text-small text-text-ink font-mono"
              value={drafts[key]}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              spellCheck={false}
            />
          )}
          <div className="flex items-center gap-12 mt-8 flex-wrap">
            <Button size="sm" variant="sun" onClick={() => save(key)} isLoading={busyKey === key}>
              {labels['admin.config.save']}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (historyKey === key ? setHistoryKey(null) : loadHistory(key))}
              isLoading={historyLoading && historyKey === key}
            >
              {historyKey === key
                ? labels['admin.config.history_hide']
                : labels['admin.config.history_show']}
            </Button>
            {messages[key] ? (
              <span className="text-small text-text-secondary">{messages[key]}</span>
            ) : null}
          </div>
          {historyKey === key ? (
            <div className="mt-12 border-t border-border-line pt-12">
              {historyError ? (
                <p className="text-small text-state-error">{historyError}</p>
              ) : historyLoading ? (
                <p className="text-small text-text-secondary">{labels['admin.config.history_loading']}</p>
              ) : historyRows.length === 0 ? (
                <p className="text-small text-text-secondary">{labels['admin.config.history_empty']}</p>
              ) : (
                <ul className="space-y-8 text-small">
                  {historyRows.map((row) => (
                    <li key={row.id} className="bg-surface-ivory rounded-sm p-12">
                      <p className="text-text-secondary">
                        {new Date(row.createdAt).toLocaleString()}
                        {row.changedBy
                          ? ` · ${row.changedBy.firstName} ${row.changedBy.lastName}`
                          : ''}
                      </p>
                      <pre className="mt-4 text-xsmall font-mono overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(row.oldValue)} → {JSON.stringify(row.newValue)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
