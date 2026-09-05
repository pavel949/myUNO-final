import type { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { LegalEntityBlock } from '@/components';

export const dynamic = 'force-dynamic';

/**
 * The `legal.*` keys this page reads. Entity values are the Q16 facts
 * (doc 08 §2), already seeded; the labels around them are UI copy.
 */
const LEGAL_LABELS = {
  'legal.terms.title': 'Terms of Service',
  'legal.terms.pending': 'The full terms of service are being prepared with counsel. Until they are published here, the operating entity below is who you are contracting with, and its contact details are how to reach us about any term.',
  'legal.entity.title': 'Who operates myUNO',
  'legal.entity.controller_title': 'Data controller',
  'legal.entity.controller_body':
    'This entity is the data controller for personal data collected through myUNO under Thailand’s Personal Data Protection Act. Use the contact details below for any access, correction or deletion request.',
  'legal.entity.label.name': 'Operating entity',
  'legal.entity.label.dbd_registration': 'DBD registration',
  'legal.entity.label.address': 'Registered address',
  'legal.entity.label.director': 'Director',
  'legal.entity.label.email': 'Email',
  'legal.entity.label.phone': 'Phone',
  'legal.entity.name': 'Ignatev Estate Co., Ltd',
  'legal.entity.dbd_registration': '083-5-56602358-7',
  'legal.entity.address':
    'Plaza Del Mar, No.1 Pasak-Koktanod Rd, office 115–116, Cherngtalay, Thalang, Phuket 83110',
  'legal.entity.director': 'Pavel Ignatev',
  'legal.entity.email': 'pavel@ignatevestate.com',
  'legal.entity.phone': '+66 92 240 7355',
};

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({ 'legal.terms.title': LEGAL_LABELS['legal.terms.title'] });
  return {
    title: `${labels['legal.terms.title']} | myUNO`,
    alternates: publicPageAlternates('/legal/terms'),
  };
}

export default async function TermsPage() {
  const labels = await getLabels(LEGAL_LABELS);

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-display-xl font-semibold">{labels['legal.terms.title']}</h1>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-24 py-40 flex flex-col gap-32">
        {/* The substantive terms are counsel's to write, not ours to invent
            (docs/open_questions.md Q16 follow-up). What we can state today is
            exactly who the counterparty is. */}
        <p className="text-body text-text-secondary">{labels['legal.terms.pending']}</p>

        <LegalEntityBlock labels={labels} />
      </div>
    </main>
  );
}
