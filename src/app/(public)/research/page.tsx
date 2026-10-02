import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getDestination } from '@/modules/destinations';
import { listPublishedResearch } from '@/modules/research';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  const destination = getDestination();
  const locale = getRequestLocale();
  let publications = await listPublishedResearch(prisma, destination.key, locale);
  if (!publications.length && locale !== 'en') publications = await listPublishedResearch(prisma, destination.key, 'en');

  const labels = await getLabels({
    'research.kicker': 'MYUNO RESEARCH',
    'research.title': 'Market evidence, with sources.',
    'research.body': 'Published research is independently reviewed, cites numbered sources and keeps a public correction log.',
    'research.read': 'Read research',
    'research.sources': '{count} sources',
    'research.empty': 'No governed research has been published yet.',
  });

  return <main className="min-h-screen bg-surface-ivory">
    <section className="border-b border-border-line bg-surface-paper px-20 py-56 md:px-32 md:py-80">
      <div className="mx-auto max-w-7xl">
        <p className="text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">{labels['research.kicker']}</p>
        <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold text-text-ink">{labels['research.title']}</h1>
        <p className="mt-16 max-w-3xl text-body text-text-secondary">{labels['research.body']}</p>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
      {publications.length ? <div className="grid gap-16 md:grid-cols-2 lg:grid-cols-3">
        {publications.map(publication => <Link key={publication.id} href={`/research/${publication.slug}`} className="flex min-h-[260px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24 transition hover:shadow-card">
          <div><p className="text-small font-semibold uppercase tracking-[0.08em] text-brand-andaman">{publication.locale.toUpperCase()}</p><h2 className="mt-8 font-display text-title font-semibold text-text-ink">{publication.title}</h2><p className="mt-12 text-body text-text-secondary">{publication.summary}</p></div>
          <div className="mt-20 flex items-center justify-between gap-12 text-small"><span className="text-text-secondary">{labels['research.sources'].replace('{count}',String(publication.sources.length))}</span><span className="font-semibold text-brand-andaman">{labels['research.read']} →</span></div>
        </Link>)}
      </div> : <p className="rounded-2xl border border-border-line bg-surface-paper p-24 text-text-secondary">{labels['research.empty']}</p>}
    </section>
  </main>;
}
