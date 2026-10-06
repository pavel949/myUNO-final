import type { Metadata } from 'next';
import { StitchMain, PublicHero, Panel, LinkButton } from '@/components/premium/StitchPage';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const ABOUT_LABELS = {
  'about.title': 'About Ignatev Estate and myUNO',
  'about.intro':
    'Ignatev Estate operates myUNO — a platform designed for 20-year wealth building through serviced living in Phuket.',
  'about.ignatev_title': 'Ignatev Estate',
  'about.ignatev_body':
    'Founded on principles of long-term value creation, Ignatev Estate manages the complete real estate lifecycle: acquisition, operations, and exit. We qualify assets for stability, operate them to standard, and report to owners transparently — not short-term arbitrage, but 20-year wealth building.',
  'about.clearview_title': 'ClearView — Asset Qualification',
  'about.clearview_body':
    'Before any property enters myUNO, ClearView conducts due diligence. Title audits, condition surveys, and market assessment ensure only suitable assets carry the Ignatev brand. This qualification is a hard gate: no unit goes live without certified permitted use.',
  'about.myuno_title': 'myUNO — Operating Platform',
  'about.myuno_body':
    'myUNO runs the whole stay: booking, check-in, concierge, services, housekeeping, checkout, and payouts. Guest journeys are transparent — every booking shows the line-item breakdown, every stay gets documented, every service is rated. Owners see real-time bookings and monthly statements tracing every baht.',
  'about.loop_title': 'The Compounding Loop',
  'about.loop_body':
    'A guest stays once and becomes a buyer. A buyer sees how the homes are run and becomes an owner. An owner with multiple units becomes managed. The same identity flows through all three roles on one platform — no silos, no separate systems. Repeat guests drive occupancy; owners drive expansion; data drives decision-making.',
  'about.services_title': 'Services Marketplace',
  'about.services_body':
    'Guests order airport transfers, flower deliveries, spa treatments, and cleaning services within the booking. Providers are vetted; services are priced transparently; ratings are public. Owners see demand patterns; guests get one-tap ordering; the platform earns a margin on each transaction.',
  'about.commitment_title': 'Our Commitment',
  'about.commitment_body':
    'myUNO is operated by Ignatev Estate Co., Ltd., a company registered in Thailand. Every guest is verified; every payment is recorded; every complaint is tracked. Personal data is encrypted and audited. Immigration compliance (TM30) is automatic. We operate transparently — no surprises, no hidden fees, no invention.',
  'about.operator_title': 'Who operates myUNO',
  'about.operator_body':
    'myUNO by Ignatev Estate Co., Ltd. (DBD 083-5-56602358-7), Phuket. Ignatev Estate runs day-to-day operations, guest relations and platform development.',
  'about.team_title': 'Leadership',
  'about.team_body':
    'Pavel Ignatev, Founder — 20+ years in real estate economics and operations in Southeast Asia. The model reflects decades of learning from properties that worked and those that did not.',
  'about.contact_title': 'Get in Touch',
  'about.contact_body':
    'Questions about ownership, bookings, or partnerships? Contact pavel@ignatevestate.com or reach our concierge on WhatsApp at +66 954243332.',
  'about.cta_title': 'Ready to join?',
  'about.cta_book': 'Book a stay',
  'about.cta_owner': 'Become an owner',
};

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'about.title': ABOUT_LABELS['about.title'],
    'about.intro': ABOUT_LABELS['about.intro'],
  });
  return {
    title: `${labels['about.title']} | myUNO`,
    description: labels['about.intro'],
    alternates: publicPageAlternates('/about'),
  };
}

export default async function AboutPage() {
  const labels = await getLabels(ABOUT_LABELS);

  const sections = [
    {
      key: 'ignatev',
      title: labels['about.ignatev_title'],
      body: labels['about.ignatev_body'],
    },
    {
      key: 'clearview',
      title: labels['about.clearview_title'],
      body: labels['about.clearview_body'],
    },
    {
      key: 'myuno',
      title: labels['about.myuno_title'],
      body: labels['about.myuno_body'],
    },
    {
      key: 'loop',
      title: labels['about.loop_title'],
      body: labels['about.loop_body'],
    },
    {
      key: 'services',
      title: labels['about.services_title'],
      body: labels['about.services_body'],
    },
    {
      key: 'commitment',
      title: labels['about.commitment_title'],
      body: labels['about.commitment_body'],
    },
    {
      key: 'operator',
      title: labels['about.operator_title'],
      body: labels['about.operator_body'],
    },
    {
      key: 'team',
      title: labels['about.team_title'],
      body: labels['about.team_body'],
    },
    {
      key: 'contact',
      title: labels['about.contact_title'],
      body: labels['about.contact_body'],
    },
  ];

  return (
    <StitchMain narrow>
      <PublicHero dark title={labels['about.title']} body={labels['about.intro']} />
      {sections.map((section) => (
        <Panel key={section.key} title={section.title}>
          <p className="text-body text-text-secondary">{section.body}</p>
        </Panel>
      ))}
      <Panel soft className="text-center">
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['about.cta_title']}</h2>
        <div className="mt-20 flex flex-col justify-center gap-12 sm:flex-row">
          <LinkButton href="/register">{labels['about.cta_book']}</LinkButton>
          <LinkButton href="/owners" variant="secondary">{labels['about.cta_owner']}</LinkButton>
        </div>
      </Panel>
    </StitchMain>
  );
}
