import type { Metadata } from 'next';
import { StitchMain, PublicHero, Panel, LinkButton } from '@/components/premium/StitchPage';
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
    <StitchMain narrow>
      <PublicHero dark title={labels['trust.title']} body={labels['trust.intro']} />
      {pillars.map((pillar) => (
        <Panel key={pillar.key} title={pillar.title}>
          <p className="text-body text-text-secondary">{pillar.body}</p>
        </Panel>
      ))}
      <LinkButton href="/trust/ombudsman" variant="ghost">{labels['trust.ombudsman_link']} →</LinkButton>
    </StitchMain>
  );
}
