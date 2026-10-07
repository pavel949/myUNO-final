/* eslint-disable local-rules/no-literal-ui-text */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FieldRow = {
  key: string;
  label: string;
  translations: Record<string, string>;
};

const locales = ['en', 'ru', 'th'] as const;

export default function ProjectStoryEditor({
  projectId,
  fields,
}: {
  projectId: string;
  fields: FieldRow[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string,string>>(
    Object.fromEntries(fields.flatMap(field => locales.map(locale => [
      `${field.key}::${locale}`,
      field.translations[locale] || '',
    ])))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(field: string, locale: string) {
    const id = `${field}::${locale}`;
    setBusy(id); setMessage(null);
    const res = await fetch(`/api/admin/projects/${projectId}/experience/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, locale, value: drafts[id] ?? '' }),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? 'Project content saved.' : data?.error || 'Could not save project content.');
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return <section className="rounded-md border border-border-line bg-surface-paper p-20">
    <div className="mb-16">
      <h2 className="font-display text-heading-2 font-semibold text-text-ink">Story, positioning & guest rules</h2>
      <p className="mt-4 max-w-3xl text-small text-text-secondary">
        These are the same canonical translations used by the Project Portal. Edit them here instead of maintaining a separate CMS.
      </p>
    </div>
    {message ? <p role="status" className="mb-12 rounded-md bg-surface-subtle p-12 text-small">{message}</p> : null}
    <div className="space-y-16">
      {fields.map(field => <div key={field.key} className="rounded-lg border border-border-line p-16">
        <p className="font-semibold text-text-ink">{field.label}</p>
        <p className="mt-8 text-small text-text-secondary">{field.key}</p>
        <div className="mt-12 grid gap-12 lg:grid-cols-3">
          {locales.map(locale => {
            const id = `${field.key}::${locale}`;
            return <label key={locale} className="text-small uppercase text-text-secondary">
              {locale}
              <textarea
                rows={field.key.includes('headline') || field.key.endsWith('.title') || field.key.endsWith('.cta') ? 2 : 4}
                value={drafts[id] ?? ''}
                onChange={e => setDrafts(prev => ({ ...prev, [id]: e.target.value }))}
                className="mt-4 min-h-80 w-full rounded-md border border-border-line bg-surface-ivory p-8 text-small normal-case text-text-ink"
              />
              <button
                type="button"
                onClick={() => save(field.key, locale)}
                disabled={busy === id}
                className="mt-8 rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman disabled:opacity-50"
              >
                {busy === id ? 'Saving…' : `Save ${locale.toUpperCase()}`}
              </button>
            </label>;
          })}
        </div>
      </div>)}
    </div>
  </section>;
}
