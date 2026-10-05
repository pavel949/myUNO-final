import Link from 'next/link';
import { getRequestLocale } from '@/lib/i18n';
import { supplierCopy } from '@/modules/onboarding/supplier-copy';
import { LeadFormSection } from '@/app/(public)/lead-form-section';

const leadAudience = 'owners' as const;

export const metadata = { title: 'Vacation rental & property listing | myUNO' };

export default async function RentOutPage() {
  const copy = supplierCopy(getRequestLocale());

  const goals = [
    {
      title: copy.goalShort,
      body: copy.goalShortBody,
      href: '/property/onboard?kind=home&offers=short_stay',
    },
    {
      title: copy.goalStable,
      body: copy.goalStableBody,
      href: '/property/onboard?kind=home&offers=monthly,yearly',
    },
    {
      title: copy.goalFlexible,
      body: copy.goalFlexibleBody,
      href: '/property/onboard?kind=home&offers=short_stay,monthly,yearly',
    },
    {
      title: copy.goalManaged,
      body: copy.goalManagedBody,
      href: '/property/onboard?kind=home&offers=short_stay,monthly,yearly&operatingModel=via_management_company',
    },
  ];

  const activation = [
    copy.howProperty,
    copy.howGoal,
    copy.howEligibility,
    copy.howPricing,
    copy.howDistribution,
    copy.howOperate,
    copy.howReport,
  ];

  return (
    <main className="stitch-workspace">
      <section className="border-b border-border-line bg-surface-paper">
        <div className="mx-auto grid max-w-content gap-24 px-20 py-56 md:px-32 md:py-80 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          <div>
            <p className="text-kicker uppercase text-brand-andaman">{copy.vacationKicker}</p>
            <h1 className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
              {copy.vacationTitle}
            </h1>
            <p className="mt-16 max-w-3xl text-body text-text-secondary">{copy.vacationBody}</p>

            <div className="mt-44 flex flex-wrap gap-12">
              <Link
                href="/property/onboard?kind=home"
                className="inline-flex min-h-48 items-center rounded-lg bg-brand-andaman px-24 py-12 font-semibold text-white"
              >
                {copy.list} →
              </Link>
              <Link
                href="/property/listings"
                className="inline-flex min-h-48 items-center rounded-lg border border-border-line px-24 py-12 font-semibold text-text-ink"
              >
                {copy.listings}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-brand-deep p-24 text-surface-ivory md:p-32">
            <h2 className="font-display text-title font-semibold">{copy.howTitle}</h2>
            <div className="mt-40 flex flex-wrap gap-8">
              {activation.map((step, index) => (
                <div
                  key={step}
                  className="inline-flex min-h-40 items-center rounded-full border border-white/15 px-12 text-small font-semibold"
                >
                  <span className="mr-8 text-brand-sun">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-20 py-56 md:px-32 md:py-80" aria-labelledby="rental-goal">
        <div className="max-w-3xl">
          <p className="text-kicker uppercase text-brand-andaman">{copy.strategy}</p>
          <h2 id="rental-goal" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
            {copy.goalTitle}
          </h2>
          <p className="mt-12 text-body text-text-secondary">{copy.responsibility}</p>
        </div>

        <div className="mt-44 grid gap-16 md:grid-cols-2">
          {goals.map((goal) => (
            <Link
              key={goal.title}
              href={goal.href}
              className="group rounded-2xl border border-border-line bg-surface-paper p-24 transition hover:border-brand-andaman hover:shadow-card"
            >
              <h3 className="font-display text-title font-semibold text-text-ink">{goal.title}</h3>
              <p className="mt-8 text-body text-text-secondary">{goal.body}</p>
              <span className="mt-40 inline-flex min-h-44 items-center text-small font-semibold text-brand-andaman">
                {copy.list} →
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-32 grid gap-16 border-t border-border-line pt-32 md:grid-cols-2">
          <div className="rounded-2xl border border-border-line bg-surface-paper p-24">
            <p className="text-kicker uppercase text-brand-andaman">{copy.owner}</p>
            <p className="mt-8 text-body text-text-secondary">{copy.listingBody}</p>
            <Link
              href="/property/onboard?kind=home"
              className="mt-40 inline-flex min-h-44 items-center font-semibold text-brand-andaman hover:underline"
            >
              {copy.list} →
            </Link>
          </div>
          <div className="rounded-2xl border border-border-line bg-surface-paper p-24">
            <p className="text-kicker uppercase text-brand-andaman">{copy.company}</p>
            <p className="mt-8 text-body text-text-secondary">{copy.managementBody}</p>
            <Link
              href="/manage"
              className="mt-40 inline-flex min-h-44 items-center font-semibold text-brand-andaman hover:underline"
            >
              {copy.request} →
            </Link>
          </div>
        </div>
      </section>

      <LeadFormSection audience={leadAudience} initialMessage={copy.listingMessage} />
    </main>
  );
}
