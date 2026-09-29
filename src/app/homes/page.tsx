import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listPublicCommercialHomes, type HomeIntent } from '@/modules/projects/commercial-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';

export const dynamic = 'force-dynamic';

export default async function HomesPage({ searchParams }: {
  searchParams?: { intent?: string };
}) {
  const intent: HomeIntent = searchParams?.intent === 'rent' ? 'rent' : 'buy';
  const [homes, labels] = await Promise.all([
    listPublicCommercialHomes(prisma, intent),
    getLabels({
      'homes.title': 'Homes in Phuket',
      'homes.subtitle': 'Explore real properties with documented listing authority. Every transaction is reviewed individually.',
      'homes.buy': 'Buy',
      'homes.rent': 'Long-term rent',
      'homes.empty': 'No verified properties are currently published for this option. Submit an enquiry for a tailored search.',
      'homes.bedrooms': 'bedrooms',
      'homes.bathrooms': 'bathrooms',
      'homes.area': 'sqm',
      'homes.details': 'Explore property',
      'homes.price': 'Commercial terms on request',
      'homes.contact': 'Tell us what you are looking for',
    }),
  ]);
  const modeLink = (value: HomeIntent) => '/homes?intent=' + value;
  return <main className="min-h-screen bg-surface-ivory">
    <section className="bg-brand-deep px-20 py-48 text-surface-ivory md:px-32 md:py-64">
      <div className="mx-auto max-w-6xl">
        <p className="text-kicker uppercase tracking-widest text-brand-sun-soft">myUNO · REAL ESTATE</p>
        <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['homes.title']}</h1>
        <p className="mt-12 max-w-2xl text-body text-surface-ivory/90">{labels['homes.subtitle']}</p>
      </div>
    </section>
    <div className="mx-auto max-w-6xl px-20 py-40 md:px-32">
      <nav aria-label={labels['homes.title']} className="mb-32 flex flex-wrap gap-8">
        {(['buy','rent'] as const).map(mode =>
          <Link key={mode} href={modeLink(mode)} aria-current={intent===mode?'page':undefined}
            className={'rounded-full border px-24 py-12 text-small font-semibold '+
              (intent===mode?'border-brand-deep bg-brand-deep text-white':'border-border-line bg-surface-paper text-text-ink')}>
            {mode==='buy'?labels['homes.buy']:labels['homes.rent']}
          </Link>)}
      </nav>
      {homes.length ? <div className="grid gap-20 sm:grid-cols-2 lg:grid-cols-3">
        {homes.map(home => <Link href={'/homes/'+encodeURIComponent(home.id)+'?intent='+intent} key={home.id}
          className="group overflow-hidden rounded-xl border border-border-line bg-surface-paper hover:shadow-card focus-visible:outline-2 focus-visible:outline-brand-andaman">
          {home.imageUrl ? <Image src={home.imageUrl} alt={home.name} width={760} height={500}
            className="aspect-[3/2] w-full object-cover" /> :
            <div className="aspect-[3/2] bg-surface-ivory"/>}
          <div className="space-y-8 p-20">
            <p className="text-small text-brand-andaman">{home.project.name}</p>
            <h2 className="font-display text-heading-3 font-semibold text-text-ink">{home.name}</h2>
            <p className="text-small text-text-secondary">
              {home.bedrooms} {labels['homes.bedrooms']} · {home.bathrooms} {labels['homes.bathrooms']}
              {home.sizeSqm ? ' · '+home.sizeSqm+' '+labels['homes.area'] : ''}
            </p>
            <p className="text-small text-text-secondary">{labels['homes.price']}</p>
            <span className="inline-block text-small font-semibold text-brand-andaman group-hover:underline">{labels['homes.details']} →</span>
          </div>
        </Link>)}
      </div> : <div role="status" className="rounded-xl border border-border-line bg-surface-paper p-24 text-body text-text-secondary">
        {labels['homes.empty']}
      </div>}
    </div>
    <section aria-label={labels['homes.contact']}>
      <LeadFormSection audience={intent==='buy'?'buyers':'renters'}
        initialMessage={intent==='buy'?'I am looking to purchase a property in Phuket.':'I am looking for a long-term rental in Phuket.'} />
    </section>
  </main>;
}
