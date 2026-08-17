import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const TRUST_LABELS = {
  'trust.title': 'Trust at myUNO',
  'trust.intro': 'Every guest verified. Every payment recorded. Every complaint tracked.',
  'trust.verified.title': 'Every guest is verified',
  'trust.verified.body':
    'Passports are captured before arrival and filed with immigration within 24 hours, as Thai law requires. Owners know who slept in their unit; guests know their neighbours were checked the same way.',
  'trust.recorded.title': 'Every payment is on the record',
  'trust.recorded.body':
    'Cash or card, every baht is receipted against the booking it belongs to and posted to a ledger that is never rewritten. Owner statements trace line by line back to the bookings and costs behind them.',
  'trust.tracked.title': 'Every complaint is tracked',
  'trust.tracked.body':
    'Raise an issue and you see the same status and history our staff see, with the clock running against a published response time. Nothing is resolved by being quietly forgotten.',
  'trust.ombudsman_link': 'About the independent Ombudsman',
};

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'trust.title': TRUST_LABELS['trust.title'],
    'trust.intro': TRUST_LABELS['trust.intro'],
  });
  return {
    title: `${labels['trust.title']} | myUNO`,
    description: labels['trust.intro'],
    alternates: publicPageAlternates('/trust'),
  };
}

export default async function TrustPage() {
  const labels = await getLabels(TRUST_LABELS);

  const pillars = (['verified', 'recorded', 'tracked'] as const).map((key) => ({
    key,
    title: labels[`trust.${key}.title`],
    body: labels[`trust.${key}.body`],
  }));

  return (
    <main className="min-h-screen bg-surface-background">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">{labels['trust.title']}</h1>
          <p className="text-body text-surface-ivory/90">{labels['trust.intro']}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-24 py-40 flex flex-col gap-24">
        {pillars.map((pillar) => (
          <section
            key={pillar.key}
            className="bg-surface-paper border border-border-line rounded-md p-32"
          >
            <h2 className="text-heading-3 font-bold text-text-ink mb-12">{pillar.title}</h2>
            <p className="text-body text-text-secondary">{pillar.body}</p>
          </section>
        ))}

        <Link
          href="/trust/ombudsman"
          className="text-body font-semibold text-brand-andaman underline underline-offset-2"
        >
          {labels['trust.ombudsman_link']} →
        </Link>
      </div>
    </main>
  );
}
