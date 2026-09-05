import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const ABOUT_LABELS = {
  'about.title': 'About Ignatev Estate and myUNO',
  'about.intro':
    'Ignatev Estate operates myUNO — a platform designed for 20-year wealth building through serviced living in Phuket.',
  'about.ignatev_title': 'Ignatev Estate',
  'about.ignatev_body':
    'Founded on principles of long-term value creation, Ignatev Estate manages the complete real estate lifecycle: acquisition, operations, and exit. We qualify assets for stability, operate them to standard, and deliver transparent returns to owners — not short-term arbitrage, but 20-year wealth building.',
  'about.clearview_title': 'ClearView — Asset Qualification',
  'about.clearview_body':
    'Before any property enters myUNO, ClearView conducts due diligence. Title audits, condition surveys, and market assessment ensure only suitable assets carry the Ignatev brand. This qualification is a hard gate: no unit goes live without certified permitted use.',
  'about.myuno_title': 'myUNO — Operating Platform',
  'about.myuno_body':
    'myUNO runs the whole stay: booking, check-in, concierge, services, housekeeping, checkout, and payouts. Guest journeys are transparent — every booking shows the line-item breakdown, every stay gets documented, every service is rated. Owners see real-time bookings and monthly statements tracing every dollar.',
  'about.loop_title': 'The Compounding Loop',
  'about.loop_body':
    'A guest stays once and becomes a buyer. A buyer sees the returns and becomes an owner. An owner with multiple units becomes managed. The same identity flows through all three roles on one platform — no silos, no separate systems. Repeat guests drive occupancy; owners drive expansion; data drives decision-making.',
  'about.services_title': 'Services Marketplace',
  'about.services_body':
    'Guests order airport transfers, flower deliveries, spa treatments, and cleaning services within the booking. Providers are vetted; services are priced transparently; ratings are public. Owners see demand patterns; guests get one-tap ordering; the platform earns a margin on each transaction.',
  'about.commitment_title': 'Our Commitment',
  'about.commitment_body':
    'Ignatev Estate is licensed to operate in Thailand. Every guest is verified; every payment is recorded; every complaint is tracked. Personal data is encrypted and audited. Immigration compliance (TM30) is automatic. We operate transparently — no surprises, no hidden fees, no invention.',
  'about.toplight_title': 'About Toplight Asia Pacific',
  'about.toplight_body':
    'Toplight Asia Pacific Co., Ltd. (DBD 0115658039800) operates myUNO as a service brand. Toplight manages day-to-day operations, guest relations, and platform development under the Ignatev Estate business model.',
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
      key: 'toplight',
      title: labels['about.toplight_title'],
      body: labels['about.toplight_body'],
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
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-display-xl font-semibold mb-24">{labels['about.title']}</h1>
          <p className="text-body text-surface-ivory/90">{labels['about.intro']}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-24 py-40 flex flex-col gap-24">
        {sections.map((section) => (
          <section
            key={section.key}
            className="bg-surface-paper border border-border-line rounded-md p-32"
          >
            <h2 className="text-heading-3 font-bold text-text-ink mb-12">{section.title}</h2>
            <p className="text-body text-text-secondary">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="bg-surface-paper py-40 px-24 border-t border-border-line">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-heading-2 font-bold text-text-ink mb-24">{labels['about.cta_title']}</h3>
          <div className="flex flex-col sm:flex-row gap-16 justify-center">
            <Link
              href="/register"
              className="px-32 py-16 bg-brand-andaman text-surface-ivory rounded-md hover:bg-brand-andaman-dark transition-colors font-semibold"
            >
              {labels['about.cta_book']}
            </Link>
            <Link
              href="/owners"
              className="px-32 py-16 border-2 border-brand-andaman text-brand-andaman rounded-md hover:bg-brand-andaman/10 transition-colors font-semibold"
            >
              {labels['about.cta_owner']}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
