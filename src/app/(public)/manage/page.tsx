import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { ProcessStepper } from '@/components/premium/PremiumPrimitives';

export const metadata: Metadata = {
  title: 'Property management in Phuket | myUNO',
  description: 'Professional property and portfolio management connected to the same canonical myUNO property, booking, operations and owner-finance records.',
};

export default async function ManagePage() {
  const labels = await getLabels({
    'manage.kicker': 'PROFESSIONAL MANAGEMENT',
    'manage.title': 'One property record from commercial activation to daily operations.',
    'manage.body': 'Manage is the operating relationship: pricing, distribution, bookings, guest operations, housekeeping, maintenance, finance and owner reporting remain connected to the same Project and Unit used on the public marketplace.',
    'manage.primary': 'Request management',
    'manage.rentout': 'I only want to rent it out',
    'manage.scope.title': 'What professional management connects',
    'manage.scope.revenue': 'Revenue & distribution',
    'manage.scope.revenue_body': 'Rate plans, channel distribution, availability and commercial offerings stay linked to the canonical inventory.',
    'manage.scope.guest': 'Guest operations',
    'manage.scope.guest_body': 'Booking, pre-arrival, check-in, in-stay requests, services and checkout run against one booking record.',
    'manage.scope.asset': 'Property operations',
    'manage.scope.asset_body': 'Housekeeping, maintenance, inspections and incidents stay attached to the actual Unit.',
    'manage.scope.owner': 'Owner transparency',
    'manage.scope.owner_body': 'Statements, costs, payouts and operational history remain visible through the owner relationship.',
    'manage.scope.team': 'Team & permissions',
    'manage.scope.team_body': 'Project and unit access is role-scoped; operational users do not receive unnecessary administrative access.',
    'manage.scope.services': 'Services marketplace',
    'manage.scope.services_body': 'Approved services can be ordered around a stay or property without fabricating a booking.',
    'manage.path.title': 'From request to managed operation',
    'manage.path.property': 'Identify property',
    'manage.path.authority': 'Verify authority',
    'manage.path.scope': 'Agree scope',
    'manage.path.engagement': 'Management engagement',
    'manage.path.activate': 'Activate operations',
    'manage.owner.title': 'Single property owner',
    'manage.owner.body': 'Start with one Unit and one management request. Existing project facts are inherited rather than re-entered.',
    'manage.owner.cta': 'Add property for management',
    'manage.portfolio.title': 'Developer or management company',
    'manage.portfolio.body': 'Connect a project or portfolio through scoped organization roles while preserving the same Project → Category → Unit hierarchy.',
    'manage.portfolio.cta': 'Management company pathway',
    'manage.lead': 'I would like to discuss professional management for my Phuket property or portfolio.',
  });

  const scopeCards = [
    { key: 'revenue', title: labels['manage.scope.revenue'], body: labels['manage.scope.revenue_body'] },
    { key: 'guest', title: labels['manage.scope.guest'], body: labels['manage.scope.guest_body'] },
    { key: 'asset', title: labels['manage.scope.asset'], body: labels['manage.scope.asset_body'] },
    { key: 'owner', title: labels['manage.scope.owner'], body: labels['manage.scope.owner_body'] },
    { key: 'team', title: labels['manage.scope.team'], body: labels['manage.scope.team_body'] },
    { key: 'services', title: labels['manage.scope.services'], body: labels['manage.scope.services_body'] },
  ];

  return <main className="min-h-screen bg-surface-ivory">
    <section className="bg-brand-deep px-20 py-64 text-surface-ivory md:px-32 md:py-96">
      <div className="mx-auto max-w-7xl">
        <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['manage.kicker']}</p>
        <h1 className="mt-10 max-w-4xl font-display text-[clamp(3rem,6vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
          {labels['manage.title']}
        </h1>
        <p className="mt-20 max-w-3xl text-lg leading-relaxed text-surface-ivory/75">{labels['manage.body']}</p>
        <div className="mt-28 flex flex-col gap-10 sm:flex-row">
          <Link href="/property/onboard?kind=home&operatingModel=direct_managed" className="inline-flex min-h-52 items-center justify-center rounded-lg bg-surface-paper px-24 font-semibold text-brand-deep">
            {labels['manage.primary']} →
          </Link>
          <Link href="/rent-out" className="inline-flex min-h-52 items-center justify-center rounded-lg border border-white/25 px-24 font-semibold text-white hover:bg-white/10">
            {labels['manage.rentout']} →
          </Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
      <h2 className="font-display text-display font-semibold text-text-ink">{labels['manage.scope.title']}</h2>
      <div className="mt-28 grid gap-14 sm:grid-cols-2 lg:grid-cols-3">
        {scopeCards.map((card) => <article key={card.key} className="rounded-2xl border border-border-line bg-surface-paper p-24">
          <h3 className="font-display text-title font-semibold text-text-ink">{card.title}</h3>
          <p className="mt-10 text-body text-text-secondary">{card.body}</p>
        </article>)}
      </div>
    </section>

    <section className="border-y border-border-line bg-surface-paper py-56 md:py-72">
      <div className="mx-auto max-w-7xl px-20 md:px-32">
        <h2 className="mb-28 font-display text-display font-semibold text-text-ink">{labels['manage.path.title']}</h2>
        <ProcessStepper steps={[
          { label: labels['manage.path.property'], state: 'active' },
          { label: labels['manage.path.authority'], state: 'neutral' },
          { label: labels['manage.path.scope'], state: 'neutral' },
          { label: labels['manage.path.engagement'], state: 'neutral' },
          { label: labels['manage.path.activate'], state: 'neutral' },
        ]} />
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-16 px-20 py-56 md:grid-cols-2 md:px-32 md:py-80">
      <Link href="/property/onboard?kind=home&operatingModel=direct_managed" className="group flex min-h-[280px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-28 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
        <div>
          <h2 className="font-display text-display font-semibold text-text-ink">{labels['manage.owner.title']}</h2>
          <p className="mt-12 max-w-xl text-body text-text-secondary">{labels['manage.owner.body']}</p>
        </div>
        <span className="mt-24 text-small font-semibold text-brand-andaman">{labels['manage.owner.cta']} →</span>
      </Link>
      <Link href="/management-companies" className="group flex min-h-[280px] flex-col justify-between rounded-2xl bg-brand-andaman p-28 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
        <div>
          <h2 className="font-display text-display font-semibold">{labels['manage.portfolio.title']}</h2>
          <p className="mt-12 max-w-xl text-body text-white/80">{labels['manage.portfolio.body']}</p>
        </div>
        <span className="mt-24 text-small font-semibold">{labels['manage.portfolio.cta']} →</span>
      </Link>
    </section>

    <LeadFormSection audience="owners" initialMessage={labels['manage.lead']} />
  </main>;
}
