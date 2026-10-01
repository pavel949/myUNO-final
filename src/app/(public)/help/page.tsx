import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  const labels = await getLabels({
    'help.kicker': 'HELP CENTER',
    'help.title': 'How can we help?',
    'help.body':
      'Find the right myUNO flow for stays, property, services and account support. If an answer depends on your booking or property, sign in so the team can see the correct record.',
    'help.stays.title': 'Stays & bookings',
    'help.stays.q1': 'How do I find an available stay?',
    'help.stays.a1':
      'Choose dates and guests in Stay search. Availability and applicable pricing are checked against the canonical booking inventory before you continue.',
    'help.stays.q2': 'Where do I manage an existing booking?',
    'help.stays.a2':
      'Open My trips. Your trip record shows payment, passport, change, cancellation and in-stay actions that are available for that booking.',
    'help.stays.cta': 'Search stays',
    'help.trips.cta': 'Open My trips',
    'help.property.title': 'Buying, renting & selling',
    'help.property.q1': 'How do I browse homes to buy or rent long-term?',
    'help.property.a1':
      'Use Buy or Monthly. Only homes with an eligible active commercial offering are shown publicly.',
    'help.property.q2': 'How do I start selling a property?',
    'help.property.a2':
      'Use the Sell flow to request a documented valuation and resale review. Publication remains subject to authority and property-fact checks.',
    'help.property.buy_cta': 'Browse homes',
    'help.property.sell_cta': 'Start a sale review',
    'help.owners.title': 'Owners & property managers',
    'help.owners.q1': 'How do I add a property?',
    'help.owners.a1':
      'Sign in and use Add a property. The onboarding flow attaches the unit to the existing canonical Project structure and keeps administrative access separate.',
    'help.owners.q2': 'Where do I see statements, bookings and requests?',
    'help.owners.a2':
      'Owner Hub is the main workspace for your units, bookings, statements, compliance alerts and property requests.',
    'help.owners.cta': 'Open Owner Hub',
    'help.services.title': 'Services',
    'help.services.q1': 'How do I order a service?',
    'help.services.a1':
      'Browse the Services marketplace. During a stay, opening Services from Home Space carries your booking and property context into the order flow.',
    'help.services.q2': 'What does vetted mean?',
    'help.services.a2':
      'A provider is shown as vetted only when the provider record is active and its vetting state is recorded in myUNO. It is not a guarantee of every future service outcome.',
    'help.services.cta': 'Browse services',
    'help.trust.title': 'Trust & project evidence',
    'help.trust.q1': 'What is a Project Passport?',
    'help.trust.a1':
      'The public Project Passport is an evidence snapshot built from canonical project, organization, regulatory, commercial-offering and unit-compliance records. Missing evidence is shown as not publicly evidenced.',
    'help.trust.q2': 'Is the Project Passport legal due diligence?',
    'help.trust.a2':
      'No. It is not legal advice, title due diligence, a valuation, or a warranty. Independent professional checks remain necessary before a transaction.',
    'help.trust.cta': 'Read about trust',
    'help.account.title': 'Account & support',
    'help.account.q1': 'Where can I update my account?',
    'help.account.a1':
      'Use Account after signing in. Role-specific workspaces are available from My UNO based on the roles currently assigned to your identity.',
    'help.account.q2': 'How do I report a problem?',
    'help.account.a2':
      'Sign in and open My requests. If the problem is tied to a stay or unit, opening the request from that context keeps the correct booking or property attached.',
    'help.account.cta': 'Open Account',
    'help.requests.cta': 'Open My requests',
  });

  const sections = [
    {
      title: labels['help.stays.title'],
      items: [
        [labels['help.stays.q1'], labels['help.stays.a1']],
        [labels['help.stays.q2'], labels['help.stays.a2']],
      ],
      links: [
        ['/search', labels['help.stays.cta']],
        ['/trips', labels['help.trips.cta']],
      ],
    },
    {
      title: labels['help.property.title'],
      items: [
        [labels['help.property.q1'], labels['help.property.a1']],
        [labels['help.property.q2'], labels['help.property.a2']],
      ],
      links: [
        ['/homes?intent=buy', labels['help.property.buy_cta']],
        ['/sell', labels['help.property.sell_cta']],
      ],
    },
    {
      title: labels['help.owners.title'],
      items: [
        [labels['help.owners.q1'], labels['help.owners.a1']],
        [labels['help.owners.q2'], labels['help.owners.a2']],
      ],
      links: [['/owner', labels['help.owners.cta']]],
    },
    {
      title: labels['help.services.title'],
      items: [
        [labels['help.services.q1'], labels['help.services.a1']],
        [labels['help.services.q2'], labels['help.services.a2']],
      ],
      links: [['/services', labels['help.services.cta']]],
    },
    {
      title: labels['help.trust.title'],
      items: [
        [labels['help.trust.q1'], labels['help.trust.a1']],
        [labels['help.trust.q2'], labels['help.trust.a2']],
      ],
      links: [['/trust', labels['help.trust.cta']]],
    },
    {
      title: labels['help.account.title'],
      items: [
        [labels['help.account.q1'], labels['help.account.a1']],
        [labels['help.account.q2'], labels['help.account.a2']],
      ],
      links: [
        ['/account', labels['help.account.cta']],
        ['/tickets', labels['help.requests.cta']],
      ],
    },
  ] as const;

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-brand-deep px-20 py-56 text-surface-ivory md:px-32 md:py-80">
        <div className="mx-auto max-w-6xl">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">
            {labels['help.kicker']}
          </p>
          <h1 className="mt-8 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.02em]">
            {labels['help.title']}
          </h1>
          <p className="mt-14 max-w-3xl text-body text-surface-ivory/72">
            {labels['help.body']}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-20 py-48 md:px-32 md:py-64">
        <div className="grid gap-20 lg:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-xl border border-border-line bg-surface-paper p-24"
            >
              <h2 className="font-display text-title font-semibold text-text-ink">
                {section.title}
              </h2>
              <div className="mt-16 divide-y divide-border-line">
                {section.items.map(([question, answer]) => (
                  <details key={question} className="group py-14">
                    <summary className="cursor-pointer list-none rounded-lg text-body font-semibold text-text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
                      <span className="flex items-start justify-between gap-12">
                        {question}
                        <span aria-hidden="true" className="text-brand-andaman transition group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-10 text-body leading-relaxed text-text-secondary">{answer}</p>
                  </details>
                ))}
              </div>
              <div className="mt-20 flex flex-wrap gap-12">
                {section.links.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-md text-small font-semibold text-brand-andaman hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman"
                  >
                    {label} →
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
