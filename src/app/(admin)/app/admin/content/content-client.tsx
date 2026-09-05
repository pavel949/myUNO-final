'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';

interface KeyRow {
  key: string;
  description: string;
  translations: Record<string, { value: string | null; status: string }>;
}

type Labels = Record<string, string>;

const LOCALES = ['ru', 'en', 'th', 'zh'] as const;

function mapApiKey(raw: Record<string, unknown>): KeyRow {
  const translations = Array.isArray(raw.translations) ? raw.translations : [];
  return {
    key: String(raw.key),
    description: String(raw.description || ''),
    translations: Object.fromEntries(
      translations.map((t: Record<string, unknown>) => [
        String(t.locale),
        { value: t.value ? String(t.value) : null, status: String(t.status || 'draft') },
      ])
    ),
  };
}

export default function ContentAdminClient({
  namespaces,
  initialNamespace,
  initialKeys,
  labels,
}: {
  namespaces: Array<{ namespace: string; count: number }>;
  initialNamespace: string;
  initialKeys: KeyRow[];
  labels: Labels;
}) {
  const [activeNs, setActiveNs] = useState(initialNamespace);
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNamespace = useCallback(
    async (namespace: string) => {
      setLoadingKeys(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/content/namespace/${encodeURIComponent(namespace)}`
        );
        if (!response.ok) throw new Error(labels['admin.content.error_generic']);
        const data = await response.json();
        const rows = Array.isArray(data.keys) ? data.keys.map(mapApiKey) : [];
        setKeys(rows);
        setDrafts({});
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.content.error_generic']);
        setKeys([]);
      } finally {
        setLoadingKeys(false);
      }
    },
    [labels]
  );

  useEffect(() => {
    if (activeNs && activeNs !== initialNamespace) {
      void loadNamespace(activeNs);
    }
  }, [activeNs, initialNamespace, loadNamespace]);

  const draftId = (key: string, locale: string) => `${key}::${locale}`;

  const save = async (key: string, locale: string) => {
    const id = draftId(key, locale);
    const value = drafts[id];
    if (value === undefined) return;
    setBusyKey(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, value }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.content.error_generic']);
      }
      setSavedFlash(id);
      setTimeout(() => setSavedFlash(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.content.error_generic']);
    } finally {
      setBusyKey(null);
    }
  };

  const exportNamespace = async () => {
    if (!activeNs) return;
    setError(null);
    try {
      const response = await fetch('/api/admin/content/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: activeNs }),
      });
      if (!response.ok) throw new Error(labels['admin.content.export_error']);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `content-${activeNs}-${new Date().toISOString().split('T')[0]}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.content.export_error']);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeNs) return;

    setImportBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('namespace', activeNs);
      const response = await fetch('/api/admin/content/import', { method: 'POST', body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['admin.content.import_error']);
      }
      setImportResult(
        labels['admin.content.import_success']
          .replace('{created}', String(data.created ?? 0))
          .replace('{updated}', String(data.updated ?? 0))
      );
      await loadNamespace(activeNs);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.content.import_error']);
    } finally {
      setImportBusy(false);
    }
  };

  const previewTranslation = async (key: string, locale: string) => {
    const id = `${key}::${locale}`;
    setPreviewBusy(id);
    try {
      const response = await fetch('/api/content/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, locale }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || labels['admin.content.error_generic']);
      setPreview((prev) => ({ ...prev, [id]: String(data.value ?? '') }));
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.content.error_generic']);
    } finally {
      setPreviewBusy(null);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImport}
      />

      <div className="flex flex-wrap items-center gap-8 mb-24">
        {namespaces.map((ns) => (
          <button
            key={ns.namespace}
            type="button"
            onClick={() => setActiveNs(ns.namespace)}
            className={`px-12 py-8 rounded-full text-small font-semibold border ${
              ns.namespace === activeNs
                ? 'bg-brand-andaman text-surface-ivory border-brand-andaman'
                : 'bg-surface-paper text-text-ink border-border-line hover:border-brand-andaman'
            }`}
          >
            {ns.namespace} ({ns.count})
          </button>
        ))}
        <div className="flex gap-8 ml-auto">
          <Button size="sm" variant="secondary" onClick={exportNamespace} disabled={!activeNs}>
            {labels['admin.content.export']}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            isLoading={importBusy}
            disabled={!activeNs}
          >
            {labels['admin.content.import']}
          </Button>
        </div>
      </div>

      {importResult && (
        <p className="text-body text-state-success mb-16">{importResult}</p>
      )}

      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        {error && (
          <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}
        {loadingKeys ? (
          <p className="text-body text-text-secondary">{labels['admin.content.loading']}</p>
        ) : (
          keys.map((row) => (
            <div key={row.key} className="py-16 border-b border-border-line last:border-b-0">
              <div className="flex items-center justify-between gap-8 mb-4 flex-wrap">
                <p className="text-small font-semibold text-text-ink">{row.key}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => previewTranslation(row.key, 'en')}
                  isLoading={previewBusy === `${row.key}::en`}
                >
                  {labels['admin.content.preview_en']}
                </Button>
              </div>
              {preview[`${row.key}::en`] ? (
                <p className="text-small text-text-secondary mb-8 bg-surface-ivory p-8 rounded-sm">
                  {preview[`${row.key}::en`]}
                </p>
              ) : null}
              <p className="text-small text-text-secondary mb-12">{row.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {LOCALES.map((locale) => {
                  const id = draftId(row.key, locale);
                  const current = drafts[id] ?? row.translations[locale]?.value ?? '';
                  const status = row.translations[locale]?.status;
                  return (
                    <div key={locale} className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-small font-semibold text-text-stone uppercase">
                          {locale}
                          {status === 'needs_review' && (
                            <span className="ml-8 text-state-warning normal-case">
                              · {labels['admin.content.needs_review']}
                            </span>
                          )}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => save(row.key, locale)}
                          isLoading={busyKey === id}
                          disabled={drafts[id] === undefined}
                        >
                          {savedFlash === id
                            ? labels['admin.content.saved']
                            : labels['admin.content.save']}
                        </Button>
                      </div>
                      <textarea
                        value={current}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        rows={2}
                        className="px-12 py-8 rounded-sm bg-surface-ivory border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
