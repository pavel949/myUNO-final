'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

interface KeyRow {
  key: string;
  description: string;
  translations: Record<string, { value: string | null; status: string }>;
}

type Labels = Record<string, string>;

const LOCALES = ['ru', 'en', 'th'] as const;

export default function ContentAdminClient({
  keys,
  labels,
}: {
  keys: KeyRow[];
  labels: Labels;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}
      {keys.map((row) => (
        <div key={row.key} className="py-16 border-b border-border-line last:border-b-0">
          <p className="text-small font-semibold text-text-ink mb-4">{row.key}</p>
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
                        <span className="ml-8 text-state-warning normal-case">• review</span>
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
                    className="px-12 py-8 rounded-sm bg-surface-background border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
