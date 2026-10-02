import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getDestination } from '@/modules/destinations';
import { getPublishedResearch } from '@/modules/research';

export const dynamic = 'force-dynamic';

export default async function ResearchDetailPage({ params }: { params:{slug:string} }) {
  const destination=getDestination();
  const locale=getRequestLocale();
  let publication=await getPublishedResearch(prisma,destination.key,params.slug,locale);
  if(!publication&&locale!=='en') publication=await getPublishedResearch(prisma,destination.key,params.slug,'en');
  if(!publication) notFound();

  const labels=await getLabels({
    'research.detail.back':'All research',
    'research.detail.reviewed':'Independently reviewed',
    'research.detail.sources':'Sources',
    'research.detail.corrections':'Correction log',
    'research.detail.published':'Published',
    'research.detail.source_accessed':'Accessed',
  });

  return <main className="min-h-screen bg-surface-ivory">
    <article className="mx-auto max-w-3xl px-20 py-56 md:px-32 md:py-80">
      <Link href="/research" className="text-small font-semibold text-brand-andaman">← {labels['research.detail.back']}</Link>
      <p className="mt-28 text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">{labels['research.detail.reviewed']}</p>
      <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{publication.title}</h1>
      <p className="mt-16 text-lg leading-relaxed text-text-secondary">{publication.summary}</p>
      <p className="mt-16 text-small text-text-secondary">{labels['research.detail.published']}: {publication.publishedAt?.toLocaleDateString(locale)}</p>
      <div className="mt-40 space-y-20 text-body leading-relaxed text-text-ink">
        {publication.body.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
      </div>

      <section className="mt-56 border-t border-border-line pt-32">
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['research.detail.sources']}</h2>
        <ol className="mt-20 space-y-16">
          {publication.sources.map(source=><li key={source.id} id={`source-${source.sourceNumber}`} className="text-small text-text-secondary">
            <span className="font-semibold text-text-ink">[{source.sourceNumber}]</span> <a href={source.url} target="_blank" rel="noreferrer" className="underline">{source.title}</a>{source.publisher?` · ${source.publisher}`:''}<span className="block mt-2">{labels['research.detail.source_accessed']}: {source.accessedOn.toLocaleDateString(locale)}</span>
          </li>)}
        </ol>
      </section>

      {publication.corrections.length?<section className="mt-40 border-t border-border-line pt-32">
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['research.detail.corrections']}</h2>
        <div className="mt-20 space-y-16">{publication.corrections.map(correction=><div key={correction.id} className="rounded-xl border border-border-line bg-surface-paper p-20"><p className="font-semibold text-text-ink">{correction.summary}</p><p className="mt-8 text-small text-text-secondary">{correction.detail}</p><p className="mt-8 text-small text-text-secondary">{correction.publicAt.toLocaleDateString(locale)}</p></div>)}</div>
      </section>:null}
    </article>
  </main>;
}
