'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Publication = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  summary: string;
  status: string;
  authorName: string;
  reviewerName: string | null;
  sources: Array<{ id: string; sourceNumber: number; title: string; publisher: string | null; url: string }>;
  corrections: Array<{ id: string; summary: string; publicAt: string }>;
};

async function post(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Action failed');
  return data;
}

export default function ResearchAdminClient({ publications, labels }: { publications: Publication[]; labels: Record<string,string> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (payload: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try { await post(payload); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : labels['admin.research.error']); }
    finally { setBusy(false); }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({
      action: 'create',
      slug: form.get('slug'),
      locale: form.get('locale'),
      title: form.get('title'),
      summary: form.get('summary'),
      body: form.get('body'),
      scheduledFor: form.get('scheduledFor') || null,
    });
    event.currentTarget.reset();
  };

  return <main className="max-w-5xl">
    <p className="text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">{labels['admin.research.kicker']}</p>
    <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['admin.research.title']}</h1>
    <p className="mt-12 max-w-3xl text-body text-text-secondary">{labels['admin.research.body']}</p>
    {error ? <p role="alert" className="mt-16 rounded-lg bg-state-error-soft p-12 text-state-error">{error}</p> : null}

    <form onSubmit={create} className="mt-32 grid gap-12 rounded-2xl border border-border-line bg-surface-paper p-24 md:grid-cols-2">
      <input name="slug" required placeholder={labels['admin.research.slug']} className="rounded-lg border border-border-line p-12" />
      <select name="locale" className="rounded-lg border border-border-line p-12"><option value="en">{labels['nav.locale.en']}</option><option value="ru">{labels['nav.locale.ru']}</option><option value="th">{labels['nav.locale.th']}</option><option value="zh">{labels['nav.locale.zh']}</option></select>
      <input name="title" required placeholder={labels['admin.research.pub_title']} className="rounded-lg border border-border-line p-12 md:col-span-2" />
      <textarea name="summary" required placeholder={labels['admin.research.summary']} className="min-h-24 rounded-lg border border-border-line p-12 md:col-span-2" />
      <textarea name="body" required placeholder={labels['admin.research.article_body']} className="min-h-48 rounded-lg border border-border-line p-12 md:col-span-2" />
      <label className="text-small text-text-secondary">{labels['admin.research.schedule']}<input name="scheduledFor" type="datetime-local" className="mt-8 block w-full rounded-lg border border-border-line p-12" /></label>
      <Button type="submit" disabled={busy}>{labels['admin.research.create']}</Button>
    </form>

    <div className="mt-32 space-y-20">
      {publications.length === 0 ? <p className="text-text-secondary">{labels['admin.research.empty']}</p> : publications.map((publication) => (
        <article key={publication.id} className="rounded-2xl border border-border-line bg-surface-paper p-24">
          <div className="flex flex-wrap items-start justify-between gap-12">
            <div><h2 className="font-display text-title font-semibold text-text-ink">{publication.title}</h2><p className="mt-4 text-small text-text-secondary">{publication.slug} · {publication.locale} · {publication.authorName}{publication.reviewerName ? ` · ${publication.reviewerName}` : ''}</p></div>
            <span className="rounded-full border border-border-line px-12 py-8 text-small font-semibold">{labels['admin.research.status']}: {publication.status}</span>
          </div>
          <p className="mt-12 text-body text-text-secondary">{publication.summary}</p>

          <div className="mt-20 flex flex-wrap gap-8">
            {publication.status === 'draft' ? <Button size="sm" variant="secondary" disabled={busy || publication.sources.length === 0} onClick={() => run({ action:'submit', publicationId:publication.id })}>{labels['admin.research.submit']}</Button> : null}
            {publication.status === 'in_review' ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => run({ action:'review', publicationId:publication.id })}>{labels['admin.research.review']}</Button> : null}
            {publication.status === 'reviewed' ? <Button size="sm" disabled={busy} onClick={() => run({ action:'publish', publicationId:publication.id })}>{labels['admin.research.publish']}</Button> : null}
            {publication.status === 'published' ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => run({ action:'retract', publicationId:publication.id })}>{labels['admin.research.retract']}</Button> : null}
          </div>

          <details className="mt-20">
            <summary className="cursor-pointer font-semibold text-brand-andaman">{labels['admin.research.sources']} ({publication.sources.length})</summary>
            <ol className="mt-12 space-y-8 text-small">{publication.sources.map(source => <li key={source.id}>[{source.sourceNumber}] <a href={source.url} target="_blank" rel="noreferrer" className="underline">{source.title}</a>{source.publisher ? ` · ${source.publisher}` : ''}</li>)}</ol>
            {publication.status === 'draft' ? <form className="mt-16 grid gap-8 md:grid-cols-3" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await run({ action:'add_source', publicationId:publication.id, title:form.get('title'), publisher:form.get('publisher'), url:form.get('url') }); event.currentTarget.reset(); }}>
              <input name="title" required placeholder={labels['admin.research.source_title']} className="rounded-lg border border-border-line p-12" />
              <input name="publisher" placeholder={labels['admin.research.publisher']} className="rounded-lg border border-border-line p-12" />
              <input name="url" type="url" required placeholder={labels['admin.research.url']} className="rounded-lg border border-border-line p-12" />
              <Button type="submit" size="sm" variant="secondary" disabled={busy}>{labels['admin.research.add_source']}</Button>
            </form> : null}
          </details>

          {['published','retracted'].includes(publication.status) ? <details className="mt-20">
            <summary className="cursor-pointer font-semibold text-brand-andaman">{labels['admin.research.correction']} ({publication.corrections.length})</summary>
            <form className="mt-12 grid gap-8" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await run({ action:'correct', publicationId:publication.id, summary:form.get('summary'), detail:form.get('detail') }); event.currentTarget.reset(); }}>
              <input name="summary" required placeholder={labels['admin.research.correction_summary']} className="rounded-lg border border-border-line p-12" />
              <textarea name="detail" required placeholder={labels['admin.research.correction_detail']} className="rounded-lg border border-border-line p-12" />
              <Button type="submit" size="sm" variant="secondary" disabled={busy}>{labels['admin.research.correction']}</Button>
            </form>
          </details> : null}
        </article>
      ))}
    </div>
  </main>;
}
