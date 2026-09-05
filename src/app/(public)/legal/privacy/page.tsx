import type { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { LegalEntityBlock } from '@/components';

export const dynamic = 'force-dynamic';

/**
 * The privacy notice (PDPA; doc 12).
 *
 * Until now this page carried a placeholder saying the policy was "being
 * prepared with counsel". That is a hard launch blocker rather than a cosmetic
 * one: under Thailand's PDPA the notice is part of what makes collecting the
 * data lawful, and this platform takes a passport from every foreign guest on
 * day one because TM30 requires it.
 *
 * Every statement below is written from what the system actually does — the
 * fields it stores, the retention windows in configuration, the third parties
 * it really talks to. Nothing describes a practice the code does not have.
 *
 * All of it lives in the content layer as `needs_review` drafts, which is the
 * project's existing gate for copy nobody has approved: **it must be reviewed by
 * Thai counsel before launch**, and reviewing it is a matter of editing the
 * content keys, not of changing code.
 */

const PRIVACY_LABELS = {
  'legal.privacy.title': 'Privacy Notice',
  'legal.privacy.updated_label': 'Last updated',
  'legal.privacy.updated': '24 August 2026',
  'legal.privacy.intro':
    'This notice explains what personal data myUNO collects, why, how long we keep it, and what you can ask us to do with it. It applies to guests, residents, owners, service providers and anyone else who uses the platform.',

  'legal.privacy.controller_title': 'Who is responsible',
  'legal.privacy.controller_body':
    'The company named below is the data controller under Thailand’s Personal Data Protection Act B.E. 2562 (2019). Any question or request about your personal data goes to the email address shown there.',

  'legal.privacy.collect_title': 'What we collect, and why',
  'legal.privacy.collect_intro':
    'We collect only what a particular purpose needs. Each group below says what it is for and what allows us to hold it.',
  'legal.privacy.collect_account':
    'Your account — name, email address, telephone number and preferred language, with your password stored only as a cryptographic hash we cannot reverse. This is what lets you sign in and lets us reach you about a stay. Basis: performance of our contract with you.',
  'legal.privacy.collect_booking':
    'Your booking — the property, the dates, how many people are travelling, any note you send us, and what you were charged. Basis: performance of our contract with you.',
  'legal.privacy.collect_passport':
    'Immigration data — for every foreign guest, the full name, nationality, passport number and date of birth. Thai law requires the property to report every foreign guest to the Immigration Bureau within 24 hours of arrival (form TM30). Passport numbers and dates of birth are encrypted in our database, every access to them is recorded, and they are deleted automatically after your stay. Basis: compliance with a legal obligation.',
  'legal.privacy.collect_payment':
    'Payment records — the amount, the method, the date, and a reference such as a receipt or bank transfer number. We do not store card numbers: when card payment is available it is handled by a licensed payment provider and the card details never reach us. Basis: performance of our contract, and our legal obligation to keep accounting records.',
  'legal.privacy.collect_messages':
    'Messages, requests and reviews — what you write to us or to a host, the maintenance requests you raise, and any review you leave. Basis: performance of our contract, and our legitimate interest in resolving problems and keeping a record of what was agreed.',
  'legal.privacy.collect_photos':
    'Photographs — images attached to a maintenance request, a property condition report, or a payment receipt. Basis: our legitimate interest in operating the property and resolving disputes fairly.',
  'legal.privacy.collect_usage':
    'How the platform is used — pages viewed and actions taken, recorded without your name or contact details attached. Basis: our legitimate interest in understanding and improving the service.',
  'legal.privacy.collect_marketing':
    'Marketing — if you ask us to contact you about buying or managing a property, we keep your enquiry and the contact details you gave us. Basis: your consent, which you can withdraw at any time.',

  'legal.privacy.sharing_title': 'Who else sees it',
  'legal.privacy.sharing_intro':
    'We do not sell personal data, and we never share it for someone else’s marketing. It reaches these recipients and no others:',
  'legal.privacy.sharing_immigration':
    'The Thai Immigration Bureau — the TM30 report for foreign guests, as the law requires.',
  'legal.privacy.sharing_owner':
    'The owner of the property you stay in, and any management company operating it — the dates and a limited view of the booking. They do not see your passport data.',
  'legal.privacy.sharing_provider':
    'A service provider you order from — your name and what is needed to carry out that order, and nothing about your other bookings.',
  'legal.privacy.sharing_payment':
    'The licensed payment provider, when you pay by card — directly, so that the card details never pass through us.',
  'legal.privacy.sharing_infrastructure':
    'The companies that host the platform and deliver our email. They process data on our instructions under contract and may not use it for anything of their own.',
  'legal.privacy.sharing_authorities':
    'A court, regulator or law-enforcement authority, where we are legally required to respond.',

  'legal.privacy.location_title': 'Where your data is held',
  // A content key on purpose: the hosting region is an operational fact that
  // can change, and a notice naming the wrong country is a disclosure failure
  // rather than a typo. Editing this key is how it gets corrected.
  'legal.privacy.location_body':
    'The platform and its database are hosted with Supabase and Vercel. Our database is currently located in Mumbai, India; our email is delivered by a provider based in the United States. Where personal data is transferred outside Thailand, we rely on the contractual safeguards our providers give us under the PDPA’s rules on cross-border transfer.',

  'legal.privacy.retention_title': 'How long we keep it',
  'legal.privacy.retention_passport':
    'Passport numbers and dates of birth are deleted automatically a set number of days after you check out. The period is short and is configured in the platform; ask us and we will tell you exactly what it is today.',
  'legal.privacy.retention_financial':
    'Booking and payment records are kept for as long as Thai accounting and tax law requires us to keep them.',
  'legal.privacy.retention_messages':
    'Messages, requests and reviews are kept while your relationship with us continues, and are anonymised when it ends.',
  'legal.privacy.retention_account':
    'Your account details are kept until you ask us to close the account.',

  'legal.privacy.rights_title': 'Your rights',
  'legal.privacy.rights_access': 'Ask what personal data we hold about you, and receive a copy of it.',
  'legal.privacy.rights_correct': 'Have anything inaccurate or incomplete corrected.',
  'legal.privacy.rights_delete':
    'Ask us to delete your personal data. Where the law requires us to keep a record — an immigration filing or an accounting entry — we remove your identity from it rather than destroying the record itself.',
  'legal.privacy.rights_restrict': 'Ask us to stop using your data for a particular purpose while a question about it is resolved.',
  'legal.privacy.rights_object': 'Object to our using your data where we rely on our legitimate interest.',
  'legal.privacy.rights_portability': 'Receive the data you gave us in a machine-readable form.',
  'legal.privacy.rights_withdraw':
    'Withdraw consent at any time, where consent is what we relied on. Withdrawing it does not undo what was done beforehand.',
  'legal.privacy.rights_how':
    'Write to the email address in the controller details below. We reply within the period the PDPA allows, and we will ask you to confirm who you are before acting on a request about someone’s personal data.',
  'legal.privacy.rights_complain':
    'If you are not satisfied with our answer, you may complain to Thailand’s Personal Data Protection Committee.',

  'legal.privacy.security_title': 'How we protect it',
  'legal.privacy.security_body':
    'Passport numbers and dates of birth are encrypted where they are stored. Access to them is restricted by role and every access is recorded. Traffic to the platform is encrypted in transit. We do not store card numbers at any point.',

  'legal.privacy.changes_title': 'Changes to this notice',
  'legal.privacy.changes_body':
    'If we change how we handle personal data we will update this page and change the date at the top. Where a change materially affects you, we will tell you directly.',

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

  const collected = [
    labels['legal.privacy.collect_account'],
    labels['legal.privacy.collect_booking'],
    labels['legal.privacy.collect_passport'],
    labels['legal.privacy.collect_payment'],
    labels['legal.privacy.collect_messages'],
    labels['legal.privacy.collect_photos'],
    labels['legal.privacy.collect_usage'],
    labels['legal.privacy.collect_marketing'],
  ];

  const sharing = [
    labels['legal.privacy.sharing_immigration'],
    labels['legal.privacy.sharing_owner'],
    labels['legal.privacy.sharing_provider'],
    labels['legal.privacy.sharing_payment'],
    labels['legal.privacy.sharing_infrastructure'],
    labels['legal.privacy.sharing_authorities'],
  ];

  const retention = [
    labels['legal.privacy.retention_passport'],
    labels['legal.privacy.retention_financial'],
    labels['legal.privacy.retention_messages'],
    labels['legal.privacy.retention_account'],
  ];

  const rights = [
    labels['legal.privacy.rights_access'],
    labels['legal.privacy.rights_correct'],
    labels['legal.privacy.rights_delete'],
    labels['legal.privacy.rights_restrict'],
    labels['legal.privacy.rights_object'],
    labels['legal.privacy.rights_portability'],
    labels['legal.privacy.rights_withdraw'],
  ];

  const list = (items: string[]) => (
    <ul className="flex flex-col gap-12">
      {items.map((item) => (
        <li key={item} className="text-body text-text-secondary">
          {item}
        </li>
      ))}
    </ul>
  );

  const section = (title: string, children: React.ReactNode) => (
    <section>
      <h2 className="text-heading-3 font-bold text-text-ink mb-16">{title}</h2>
      {children}
    </section>
  );

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-display-xl font-semibold">{labels['legal.privacy.title']}</h1>
          <p className="text-body mt-8 opacity-90">
            {`${labels['legal.privacy.updated_label']}: ${labels['legal.privacy.updated']}`}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-24 py-40 flex flex-col gap-32">
        <p className="text-body text-text-secondary">{labels['legal.privacy.intro']}</p>

        {section(
          labels['legal.privacy.controller_title'],
          <>
            <p className="text-body text-text-secondary mb-20">
              {labels['legal.privacy.controller_body']}
            </p>
            <LegalEntityBlock labels={labels} asDataController />
          </>
        )}

        {section(
          labels['legal.privacy.collect_title'],
          <>
            <p className="text-body text-text-secondary mb-16">
              {labels['legal.privacy.collect_intro']}
            </p>
            {list(collected)}
          </>
        )}

        {section(
          labels['legal.privacy.sharing_title'],
          <>
            <p className="text-body text-text-secondary mb-16">
              {labels['legal.privacy.sharing_intro']}
            </p>
            {list(sharing)}
          </>
        )}

        {section(
          labels['legal.privacy.location_title'],
          <p className="text-body text-text-secondary">{labels['legal.privacy.location_body']}</p>
        )}

        {section(labels['legal.privacy.retention_title'], list(retention))}

        {section(
          labels['legal.privacy.security_title'],
          <p className="text-body text-text-secondary">{labels['legal.privacy.security_body']}</p>
        )}

        {section(
          labels['legal.privacy.rights_title'],
          <>
            {list(rights)}
            <p className="text-body text-text-secondary mt-20">{labels['legal.privacy.rights_how']}</p>
            <p className="text-body text-text-secondary mt-12">
              {labels['legal.privacy.rights_complain']}
            </p>
          </>
        )}

        {section(
          labels['legal.privacy.changes_title'],
          <p className="text-body text-text-secondary">{labels['legal.privacy.changes_body']}</p>
        )}
      </div>
    </main>
  );
}
