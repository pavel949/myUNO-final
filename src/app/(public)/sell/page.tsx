import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { ProcessStepper, SourceChip } from '@/components/premium/PremiumPrimitives';
import { getDestination } from '@/modules/destinations';

const destination = getDestination();

export const metadata: Metadata = {
  title: `Sell a ${destination.name} property | myUNO`,
  description: `Start a documented resale and valuation conversation for your ${destination.name} property.`,
};

export const dynamic = 'force-dynamic';

const SELL_AUDIENCE = 'owners' as const;

export default async function SellPage() {
  const labels = await getLabels({
    'sell.kicker': 'SELL WITH MYUNO',
    'sell.title': 'Sell with evidence, not guesswork.',
    'sell.body': 'Start with the real property record, current commercial context and a documented mandate. We do not publish a listing before authority and property facts are checked.',
    'sell.cta': 'Start selling my property',
    'sell.advisor_cta': 'Request an advisor review',
    'sell.owner_cta': 'Open Owner Hub',
    'sell.process.title': 'A clear resale path',
    'sell.process.intake': 'Property intake',
    'sell.process.checks': 'Authority & facts',
    'sell.process.position': 'Position & terms',
    'sell.process.live': 'Go live',
    'sell.process.offer': 'Offers & viewing',
    'sell.process.settle': 'Settlement',
    'sell.evidence.title': 'What the review uses',
    'sell.evidence.body': 'Where evidence is available, the advisor can use the canonical unit record, project facts, current offering context and documented transaction evidence. Formal legal and valuation advice remains separate.',
    'sell.evidence.property': 'Canonical property facts',
    'sell.evidence.offering': 'Commercial offering record',
    'sell.evidence.mandate': 'Mandate evidence',
    'sell.lead.prefill': `I would like a valuation and resale review for my ${destination.name} property.`,
  });

  return (
    <main className="stitch-workspace">
      <section className="bg-brand-deep px-20 py-64 text-surface-ivory md:px-32 md:py-96">
        <div className="mx-auto max-w-7xl">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['sell.kicker']}</p>
          <h1 className="mt-12 max-w-4xl font-display text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            {labels['sell.title']}
          </h1>
          <p className="mt-20 max-w-2xl text-subtitle font-normal leading-relaxed text-surface-ivory/75">{labels['sell.body']}</p>
          <div className="mt-32 flex flex-col gap-12 sm:flex-row">
            <Link href="/property/onboard?offers=sale" className="inline-flex min-h-48 items-center justify-center rounded-lg bg-surface-paper px-24 font-semibold text-brand-deep">
              {labels['sell.cta']} →
            </Link>
            <a href="#lead-form" className="inline-flex min-h-48 items-center justify-center rounded-lg border border-white/25 px-24 font-semibold text-surface-ivory hover:bg-white/10">
              {labels['sell.advisor_cta']}
            </a>
            <Link href="/owner" className="inline-flex min-h-48 items-center justify-center rounded-lg border border-white/25 px-24 font-semibold text-surface-ivory hover:bg-white/10">
              {labels['sell.owner_cta']}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
        <h2 className="font-display text-display font-semibold text-text-ink">{labels['sell.process.title']}</h2>
        <div className="mt-32">
          <ProcessStepper
            steps={[
              { label: labels['sell.process.intake'], state: 'active' },
              { label: labels['sell.process.checks'], state: 'neutral' },
              { label: labels['sell.process.position'], state: 'neutral' },
              { label: labels['sell.process.live'], state: 'neutral' },
              { label: labels['sell.process.offer'], state: 'neutral' },
              { label: labels['sell.process.settle'], state: 'neutral' },
            ]}
          />
        </div>
      </section>

      <section className="border-y border-border-line bg-surface-paper">
        <div className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
          <h2 className="font-display text-display font-semibold text-text-ink">{labels['sell.evidence.title']}</h2>
          <p className="mt-12 max-w-3xl text-body text-text-secondary">{labels['sell.evidence.body']}</p>
          <div className="mt-20 flex flex-wrap gap-8">
            <SourceChip source={labels['sell.evidence.property']} />
            <SourceChip source={labels['sell.evidence.offering']} />
            <SourceChip source={labels['sell.evidence.mandate']} />
          </div>
        </div>
      </section>

      <LeadFormSection audience={SELL_AUDIENCE} initialMessage={labels['sell.lead.prefill']} />
    </main>
  );
}
