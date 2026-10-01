import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { ProcessStepper } from '@/components/premium/PremiumPrimitives';

export const metadata: Metadata = {
  title: 'Rent out your Phuket property | myUNO',
  description: 'Choose short stays, monthly rental or both, then connect your property to the canonical myUNO onboarding and operating model.',
};

const leadAudience = 'owners' as const;

export default async function RentOutPage() {
  const labels = await getLabels({
    'rentout.kicker': 'RENT OUT',
    'rentout.title': 'Put your property on the rental market without creating another property record.',
    'rentout.body': 'Choose how you want to rent. myUNO reuses the same canonical Project and Unit, then creates draft commercial offerings for review. Nothing becomes bookable or public until authority, permitted use and operating eligibility are verified.',
    'rentout.primary': 'Start property onboarding',
    'rentout.manage': 'I want myUNO to manage it',
    'rentout.strategy.title': 'Choose your rental strategy',
    'rentout.short.title': 'Short stays',
    'rentout.short.body': 'For nightly and weekly accommodation. Booking activation remains gated by stay authority, compliance, availability and valid pricing.',
    'rentout.short.cta': 'Start short-stay setup',
    'rentout.monthly.title': 'Monthly & long-term',
    'rentout.monthly.body': 'For monthly or yearly tenancy. The same Unit receives separate long-term commercial terms rather than a duplicate listing.',
    'rentout.monthly.cta': 'Start long-term setup',
    'rentout.both.title': 'Both',
    'rentout.both.body': 'Prepare both rental paths against one physical Unit. Each offering can be reviewed, activated or paused independently.',
    'rentout.both.cta': 'Set up both',
    'rentout.operation.title': 'Then choose who operates it',
    'rentout.operation.owner.title': 'I manage it myself',
    'rentout.operation.owner.body': 'Use myUNO for the property record and commercial activation while you remain responsible for the operating model allowed for the property.',
    'rentout.operation.manager.title': 'I already have a manager',
    'rentout.operation.manager.body': 'Keep the same property record and connect the management relationship during verification. No second inventory record is created.',
    'rentout.operation.myuno.title': 'myUNO manages it',
    'rentout.operation.myuno.body': 'Continue into the professional management path for PMS, distribution, guest operations, maintenance and owner reporting.',
    'rentout.operation.manage_cta': 'Explore professional management',
    'rentout.steps.property': 'Property',
    'rentout.steps.strategy': 'Rental strategy',
    'rentout.steps.authority': 'Authority & permitted use',
    'rentout.steps.offering': 'Draft offering',
    'rentout.steps.activate': 'Review & activate',
    'rentout.lead': 'I want to rent out my Phuket property and would like help choosing the right rental and management model.',
  });

  return <main className="min-h-screen bg-surface-ivory">
    <section className="border-b border-border-line bg-surface-paper px-20 py-56 md:px-32 md:py-80">
      <div className="mx-auto max-w-7xl">
        <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['rentout.kicker']}</p>
        <h1 className="mt-10 max-w-4xl font-display text-[clamp(3rem,6vw,5.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-text-ink">
          {labels['rentout.title']}
        </h1>
        <p className="mt-20 max-w-3xl text-lg leading-relaxed text-text-secondary">{labels['rentout.body']}</p>
        <div className="mt-28 flex flex-col gap-10 sm:flex-row">
          <Link href="/property/onboard" className="inline-flex min-h-52 items-center justify-center rounded-lg bg-brand-andaman px-24 font-semibold text-white hover:bg-brand-deep">
            {labels['rentout.primary']} →
          </Link>
          <Link href="/manage" className="inline-flex min-h-52 items-center justify-center rounded-lg border border-border-line bg-surface-paper px-24 font-semibold text-text-ink hover:border-border-line-2">
            {labels['rentout.manage']} →
          </Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
      <h2 className="font-display text-display font-semibold text-text-ink">{labels['rentout.strategy.title']}</h2>
      <div className="mt-28 grid gap-16 md:grid-cols-3">
        {[
          { title: labels['rentout.short.title'], body: labels['rentout.short.body'], cta: labels['rentout.short.cta'], href: '/property/onboard?offers=short_stay' },
          { title: labels['rentout.monthly.title'], body: labels['rentout.monthly.body'], cta: labels['rentout.monthly.cta'], href: '/property/onboard?offers=monthly,yearly' },
          { title: labels['rentout.both.title'], body: labels['rentout.both.body'], cta: labels['rentout.both.cta'], href: '/property/onboard?offers=short_stay,monthly,yearly' },
        ].map((item) => <Link key={item.href} href={item.href}
          className="group flex min-h-[260px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24 transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
          <div>
            <h3 className="font-display text-title font-semibold text-text-ink">{item.title}</h3>
            <p className="mt-10 text-body text-text-secondary">{item.body}</p>
          </div>
          <span className="mt-24 text-small font-semibold text-brand-andaman">{item.cta} →</span>
        </Link>)}
      </div>
    </section>

    <section className="border-y border-border-line bg-surface-paper py-56 md:py-72">
      <div className="mx-auto max-w-7xl px-20 md:px-32">
        <ProcessStepper steps={[
          { label: labels['rentout.steps.property'], state: 'active' },
          { label: labels['rentout.steps.strategy'], state: 'neutral' },
          { label: labels['rentout.steps.authority'], state: 'neutral' },
          { label: labels['rentout.steps.offering'], state: 'neutral' },
          { label: labels['rentout.steps.activate'], state: 'neutral' },
        ]} />
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
      <h2 className="font-display text-display font-semibold text-text-ink">{labels['rentout.operation.title']}</h2>
      <div className="mt-28 grid gap-16 md:grid-cols-3">
        <Link href="/property/onboard?operatingModel=owner_direct" className="group rounded-2xl border border-border-line bg-surface-paper p-24 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
          <h3 className="font-display text-title font-semibold text-text-ink">{labels['rentout.operation.owner.title']}</h3>
          <p className="mt-10 text-body text-text-secondary">{labels['rentout.operation.owner.body']}</p>
          <span className="mt-20 inline-block text-small font-semibold text-brand-andaman">{labels['rentout.primary']} →</span>
        </Link>
        <Link href="/property/onboard?operatingModel=via_management_company" className="group rounded-2xl border border-border-line bg-surface-paper p-24 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
          <h3 className="font-display text-title font-semibold text-text-ink">{labels['rentout.operation.manager.title']}</h3>
          <p className="mt-10 text-body text-text-secondary">{labels['rentout.operation.manager.body']}</p>
          <span className="mt-20 inline-block text-small font-semibold text-brand-andaman">{labels['rentout.primary']} →</span>
        </Link>
        <Link href="/manage" className="group rounded-2xl bg-brand-andaman p-24 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman">
          <h3 className="font-display text-title font-semibold">{labels['rentout.operation.myuno.title']}</h3>
          <p className="mt-10 text-body text-white/80">{labels['rentout.operation.myuno.body']}</p>
          <span className="mt-24 inline-block text-small font-semibold">{labels['rentout.operation.manage_cta']} →</span>
        </Link>
      </div>
    </section>

    <LeadFormSection audience={leadAudience} initialMessage={labels['rentout.lead']} />
  </main>;
}
