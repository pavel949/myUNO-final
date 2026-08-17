import type { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { LegalEntityBlock } from '@/components';

export const dynamic = 'force-dynamic';

const PRIVACY_LABELS = {
  'legal.privacy.title': 'Privacy Policy',
  'legal.privacy.pending':
    'The full privacy policy is being prepared with counsel. Until it is published here, the controller named below is responsible for your personal data, and the rights summarised on this page apply regardless.',
  'legal.privacy.rights_title': 'Your rights under the PDPA',
  'legal.privacy.rights_access': 'Ask what personal data we hold about you, and get a copy of it.',
  'legal.privacy.rights_correct': 'Have inaccurate personal data corrected.',
  'legal.privacy.rights_delete':
    'Ask for your personal data to be deleted. Records we are required to keep for financial or immigration compliance are retained, and your identity is anonymised in them instead.',
  'legal.privacy.rights_withdraw': 'Withdraw consent you have given, at any time.',
  'legal.privacy.rights_how':
    'Send any of these requests to the controller’s email below. We answer within the period the PDPA allows.',
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
  const labels = await getLabels({
    'legal.privacy.title': PRIVACY_LABELS['legal.privacy.title'],
  });
  return {
    title: `${labels['legal.privacy.title']} | myUNO`,
    alternates: publicPageAlternates('/legal/privacy'),
  };
}

export default async function PrivacyPage() {
  const labels = await getLabels(PRIVACY_LABELS);

  const rights = [
    labels['legal.privacy.rights_access'],
    labels['legal.privacy.rights_correct'],
    labels['legal.privacy.rights_delete'],
    labels['legal.privacy.rights_withdraw'],
  ];

  return (
    <main className="min-h-screen bg-surface-background">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-heading-1 font-bold">{labels['legal.privacy.title']}</h1>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-24 py-40 flex flex-col gap-32">
        <p className="text-body text-text-secondary">{labels['legal.privacy.pending']}</p>

        {/* The PDPA controller line doc 12 requires, stated before the full
            policy exists — the rights hold whether or not the prose is ready. */}
        <LegalEntityBlock labels={labels} asDataController />

        <section>
          <h2 className="text-heading-3 font-bold text-text-ink mb-16">
            {labels['legal.privacy.rights_title']}
          </h2>
          <ul className="flex flex-col gap-12 mb-20">
            {rights.map((right) => (
              <li key={right} className="text-body text-text-secondary">
                {right}
              </li>
            ))}
          </ul>
          <p className="text-body text-text-secondary">{labels['legal.privacy.rights_how']}</p>
        </section>
      </div>
    </main>
  );
}
