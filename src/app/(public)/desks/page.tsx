import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { GLOBAL_DESKS } from '@/modules/global-desks';

export const metadata: Metadata = {
  title: 'Global desks | myUNO',
  description: 'Market and language liaison routes for international myUNO users exploring Phuket property.',
};

export default async function GlobalDesksPage() {
  const labels = await getLabels({
    'desks.index.kicker': 'GLOBAL DESKS',
    'desks.index.title': 'Phuket property, easier to navigate from wherever you are.',
    'desks.index.body': 'Each desk is a market and language liaison route into the same canonical myUNO property, booking and service platform. Desks do not represent separate inventory or physical offices.',
    'desks.index.cta': 'Open desk',
    'desks.thailand.title': 'Thailand desk',
    'desks.thailand.body': 'For Thailand-based residents, owners, guests and partners navigating Phuket property and services.',
    'desks.thailand.languages': 'Thai · English',
    'desks.russian.title': 'Russian-speaking desk',
    'desks.russian.body': 'For Russian-speaking buyers, owners, guests and partners engaging with Phuket property.',
    'desks.russian.languages': 'Russian · English',
    'desks.china.title': 'Greater China desk',
    'desks.china.body': 'A market-oriented route for Chinese-speaking and Greater China audiences exploring Phuket property.',
    'desks.china.languages': 'Chinese · English',
    'desks.middle_east.title': 'Middle East desk',
    'desks.middle_east.body': 'A market-oriented route for Middle East buyers, families and investors exploring Phuket.',
    'desks.middle_east.languages': 'English',
    'desks.europe.title': 'Europe desk',
    'desks.europe.body': 'A market-oriented route for European buyers, residents and owners exploring Phuket property.',
    'desks.europe.languages': 'English',
  });

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="border-b border-border-line bg-gradient-to-br from-surface-paper via-surface-ivory to-surface-ivory px-20 py-64 md:px-32 md:py-96">
        <div className="mx-auto max-w-7xl">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['desks.index.kicker']}</p>
          <h1 className="mt-12 max-w-4xl font-display text-[clamp(3rem,6vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-text-ink">
            {labels['desks.index.title']}
          </h1>
          <p className="mt-20 max-w-3xl text-subtitle font-normal leading-relaxed text-text-secondary">{labels['desks.index.body']}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {GLOBAL_DESKS.map((desk) => (
            <Link
              key={desk.slug}
              href={`/desks/${desk.slug}`}
              className="group flex min-h-[250px] flex-col justify-between rounded-lg border border-border-line bg-surface-paper p-24 transition-all duration-structural hover:-translate-y-[1px] hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman"
            >
              <div>
                <div className="flex h-44 w-44 items-center justify-center rounded-full bg-brand-andaman/10 font-display text-small font-semibold tracking-[0.08em] text-brand-andaman">
                  {desk.code}
                </div>
                <h2 className="mt-20 font-display text-display font-semibold tracking-[-0.02em] text-text-ink">
                  {labels[desk.titleKey]}
                </h2>
                <p className="mt-12 text-body text-text-secondary">{labels[desk.bodyKey]}</p>
                <p className="mt-16 text-small font-semibold text-brand-andaman">{labels[desk.languagesKey]}</p>
              </div>
              <span className="mt-24 text-small font-semibold text-brand-andaman transition-transform group-hover:translate-x-[1px]">
                {labels['desks.index.cta']} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
