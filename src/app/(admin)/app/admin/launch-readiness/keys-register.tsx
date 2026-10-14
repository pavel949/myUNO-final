'use client';

import { useState } from 'react';

export interface KeyRow {
  name: string;
  purpose: string;
  place: string;
  groupLabel: string;
  blocking: boolean;
  /** null = the running app cannot tell (GitHub / external). */
  runtimeSet: boolean | null;
  hasValue: boolean;
  last4: string | null;
  notes: string;
}

export interface KeysLabels {
  [key: string]: string;
}

async function call(method: 'PUT' | 'POST' | 'DELETE', body: Record<string, unknown>) {
  const res = await fetch('/api/admin/secrets', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function KeysRegister({ rows, labels }: { rows: KeyRow[]; labels: KeysLabels }) {
  const [items, setItems] = useState(rows);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  const patch = (name: string, change: Partial<KeyRow>) =>
    setItems((prev) => prev.map((r) => (r.name === name ? { ...r, ...change } : r)));

  async function save(row: KeyRow) {
    const value = drafts[row.name];
    if (!value) return;
    const { ok } = await call('PUT', { name: row.name, value });
    if (!ok) return setMessage(labels.error);
    patch(row.name, { hasValue: true, last4: value.length >= 8 ? value.slice(-4) : '' });
    setDrafts((d) => ({ ...d, [row.name]: '' }));
    setMessage(labels.saved);
  }

  async function reveal(row: KeyRow) {
    const { ok, json } = await call('POST', { name: row.name });
    if (!ok) return setMessage(labels.error);
    setRevealed((r) => ({ ...r, [row.name]: json.value }));
    setTimeout(() => setRevealed((r) => ({ ...r, [row.name]: '' })), 15000);
  }

  async function clear(row: KeyRow) {
    const { ok } = await call('DELETE', { name: row.name });
    if (!ok) return setMessage(labels.error);
    patch(row.name, { hasValue: false, last4: null });
    setRevealed((r) => ({ ...r, [row.name]: '' }));
  }

  function addCustom() {
    const name = custom.trim();
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name) || items.some((r) => r.name === name)) return setMessage(labels.error);
    setItems((prev) => [
      ...prev,
      { name, purpose: labels.custom_purpose, place: 'external', groupLabel: labels.group_custom, blocking: false, runtimeSet: null, hasValue: false, last4: null, notes: '' },
    ]);
    setCustom('');
  }

  const groups = Array.from(new Set(items.map((r) => r.groupLabel)));

  return (
    <div>
      <p className="mb-16 max-w-3xl text-small text-text-secondary">{labels.disclaimer}</p>
      {message ? (
        <p role="status" className="mb-16 text-small font-semibold text-text-ink">
          {message}
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group} className="mb-32">
          <h3 className="mb-12 font-sans text-subtitle font-semibold text-text-ink">{group}</h3>
          <ul className="divide-y divide-border-line rounded-lg border border-border-line bg-surface-paper">
            {items
              .filter((r) => r.groupLabel === group)
              .map((row) => (
                <li key={row.name} className="p-16">
                  <div className="flex flex-wrap items-center gap-8">
                    <code className="font-mono text-small font-semibold text-text-ink">{row.name}</code>
                    <span className="rounded-sm bg-surface-sand px-8 py-4 text-small text-text-secondary">{labels[`place_${row.place}`]}</span>
                    {row.blocking ? <span className="text-small font-semibold text-state-error">{labels.blocking}</span> : null}
                    {row.runtimeSet === null ? null : (
                      <span className={`text-small font-semibold ${row.runtimeSet ? 'text-state-success' : 'text-state-error'}`}>
                        {row.runtimeSet ? labels.runtime_set : labels.runtime_missing}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-small text-text-secondary">{row.purpose}</p>
                  <div className="mt-12 flex flex-wrap items-center gap-8">
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label={`${row.name} ${labels.value}`}
                      placeholder={row.hasValue ? `•••• ${row.last4 ?? ''}` : labels.placeholder}
                      value={drafts[row.name] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.name]: e.target.value }))}
                      className="min-h-[44px] min-w-[220px] flex-1 rounded-md border border-border-line bg-surface-paper px-12 font-mono text-small"
                    />
                    <button type="button" onClick={() => save(row)} className="min-h-[44px] rounded-md bg-brand-andaman px-16 text-small font-semibold text-on-dark-text">
                      {labels.save}
                    </button>
                    {row.hasValue ? (
                      <>
                        <button type="button" onClick={() => reveal(row)} className="min-h-[44px] rounded-md border border-border-line px-16 text-small font-semibold">
                          {labels.reveal}
                        </button>
                        <button type="button" onClick={() => clear(row)} className="min-h-[44px] rounded-md border border-border-line px-16 text-small font-semibold text-state-error">
                          {labels.clear}
                        </button>
                      </>
                    ) : null}
                  </div>
                  {revealed[row.name] ? (
                    <p className="mt-8 break-all rounded-md bg-surface-sand p-12 font-mono text-small">{revealed[row.name]}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-8">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label={labels.custom_name}
          placeholder={labels.custom_name}
          className="min-h-[44px] min-w-[220px] rounded-md border border-border-line bg-surface-paper px-12 font-mono text-small"
        />
        <button type="button" onClick={addCustom} className="min-h-[44px] rounded-md border border-border-line px-16 text-small font-semibold">
          {labels.add_custom}
        </button>
      </div>
    </div>
  );
}
