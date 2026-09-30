'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useEffect, useState } from 'react';

type Field = {
  key: string;
  label: string;
  secret: boolean;
  env: string | null;
  placeholder: string | null;
  configured: boolean;
  source: 'vault' | 'environment' | 'missing';
  value: string;
};

type Integration = {
  key: string;
  title: string;
  description: string;
  fields: Field[];
};

type Bootstrap = {
  group: string;
  env: string;
  description: string;
  configured: boolean;
};

export default function IntegrationSettingsClient() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [clearSecrets, setClearSecrets] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/integrations/settings', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load integration settings.');
      setIntegrations(payload.integrations || []);
      setBootstrap(payload.bootstrap || []);
      const initial: Record<string, Record<string, string>> = {};
      for (const integration of payload.integrations || []) {
        initial[integration.key] = {};
        for (const field of integration.fields || []) initial[integration.key][field.key] = field.value || '';
      }
      setDrafts(initial);
    } catch {
      setMessage({ global: 'Could not load integration settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (integration: Integration) => {
    setBusy(integration.key);
    setMessage((old) => ({ ...old, [integration.key]: '' }));
    try {
      const response = await fetch('/api/admin/integrations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: integration.key,
          values: drafts[integration.key] || {},
          clearSecrets: Array.from(clearSecrets[integration.key] || []),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Save failed.');
      setMessage((old) => ({ ...old, [integration.key]: 'Saved.' }));
      setClearSecrets((old) => ({ ...old, [integration.key]: new Set() }));
      await load();
    } catch (error) {
      setMessage((old) => ({
        ...old,
        [integration.key]: error instanceof Error ? error.message : 'Save failed.',
      }));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-body text-text-secondary">Loading integrations…</p>;

  return (
    <div className="space-y-32">
      {message.global ? <p className="text-state-error">{message.global}</p> : null}

      <section>
        <div className="mb-16">
          <h2 className="font-display text-heading-2 font-semibold text-text-ink">External providers</h2>
          <p className="mt-4 text-body text-text-secondary">
            Secrets saved here are encrypted in the canonical integration vault. Existing environment variables remain valid as fallback until replaced.
          </p>
        </div>

        <div className="grid gap-16 xl:grid-cols-2">
          {integrations.map((integration) => (
            <div key={integration.key} className="rounded-xl border border-border-line bg-surface-paper p-20">
              <div className="mb-16">
                <h3 className="text-title font-semibold text-text-ink">{integration.title}</h3>
                <p className="mt-4 text-small text-text-secondary">{integration.description}</p>
              </div>

              <div className="space-y-14">
                {integration.fields.map((field) => {
                  const clearSet = clearSecrets[integration.key] || new Set<string>();
                  return (
                    <div key={field.key}>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-8">
                        <label className="text-small font-semibold text-text-ink" htmlFor={integration.key + '-' + field.key}>
                          {field.label}
                        </label>
                        <div className="flex items-center gap-6">
                          <span className={field.configured ? 'text-small text-state-success' : 'text-small text-state-error'}>
                            {field.configured ? 'Configured' : 'Missing'}
                          </span>
                          <span className="rounded-full bg-surface-muted px-8 py-2 text-[11px] text-text-secondary">
                            {field.source}
                          </span>
                        </div>
                      </div>

                      <input
                        id={integration.key + '-' + field.key}
                        type={field.secret ? 'password' : 'text'}
                        autoComplete="off"
                        value={drafts[integration.key]?.[field.key] || ''}
                        placeholder={
                          field.secret && field.configured
                            ? 'Enter a new value to replace the existing secret'
                            : field.placeholder || field.env || ''
                        }
                        onChange={(event) =>
                          setDrafts((old) => ({
                            ...old,
                            [integration.key]: {
                              ...(old[integration.key] || {}),
                              [field.key]: event.target.value,
                            },
                          }))
                        }
                        className="h-42 w-full rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink"
                      />

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-8 text-[11px] text-text-secondary">
                        <span>{field.env ? 'Environment fallback: ' + field.env : 'Stored only in integration vault'}</span>
                        {field.secret && field.configured ? (
                          <label className="flex items-center gap-6">
                            <input
                              type="checkbox"
                              checked={clearSet.has(field.key)}
                              onChange={(event) => {
                                setClearSecrets((old) => {
                                  const next = new Set(old[integration.key] || []);
                                  if (event.target.checked) next.add(field.key);
                                  else next.delete(field.key);
                                  return { ...old, [integration.key]: next };
                                });
                              }}
                            />
                            Clear saved secret
                          </label>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-18 flex items-center gap-12">
                <button
                  type="button"
                  disabled={busy === integration.key}
                  onClick={() => save(integration)}
                  className="rounded-sm bg-brand-andaman px-16 py-10 text-small font-semibold text-on-dark-text disabled:opacity-50"
                >
                  {busy === integration.key ? 'Saving…' : 'Save integration'}
                </button>
                {message[integration.key] ? (
                  <span className={message[integration.key] === 'Saved.' ? 'text-small text-state-success' : 'text-small text-state-error'}>
                    {message[integration.key]}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-16">
          <h2 className="font-display text-heading-2 font-semibold text-text-ink">Infrastructure & bootstrap variables</h2>
          <p className="mt-4 text-body text-text-secondary">
            These variables are intentionally not stored inside the database vault. The panel shows whether the running application can see them, but root credentials must be changed in the deployment or backup secret store.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border-line bg-surface-paper">
          <div className="grid grid-cols-[150px_1fr_110px] gap-12 border-b border-border-line bg-surface-muted px-16 py-10 text-small font-semibold text-text-ink md:grid-cols-[180px_260px_1fr_110px]">
            <span>Group</span>
            <span>Variable</span>
            <span className="hidden md:block">Purpose</span>
            <span>Status</span>
          </div>
          {bootstrap.map((item) => (
            <div key={item.env} className="grid grid-cols-[150px_1fr_110px] gap-12 border-b border-border-line px-16 py-12 text-small last:border-b-0 md:grid-cols-[180px_260px_1fr_110px]">
              <span className="text-text-secondary">{item.group}</span>
              <code className="break-all text-text-ink">{item.env}</code>
              <span className="hidden text-text-secondary md:block">{item.description}</span>
              <span className={item.configured ? 'text-state-success' : 'text-state-error'}>
                {item.configured ? 'Configured' : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
