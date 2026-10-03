import Link from 'next/link';
import { getRequestLocale } from '@/lib/i18n';
import { supplierCopy } from '@/modules/onboarding/supplier-copy';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
const leadAudience = 'owners' as const;
export const metadata = { title: 'List your rental property | myUNO' };
export default async function RentOutPage() {
  const copy = supplierCopy(getRequestLocale());
  return <main className="min-h-screen bg-surface-ivory">
    <section className="mx-auto max-w-content px-20 py-56">
      <h1 className="max-w-3xl font-display text-display-xl font-semibold text-text-ink">{copy.listingTitle}</h1>
      <p className="mt-16 max-w-3xl text-body text-text-secondary">{copy.listingBody}</p>
      <div className="mt-24 flex flex-wrap gap-12"><Link href="/property/onboard?kind=home&offers=short_stay,monthly,yearly" className="rounded-lg bg-brand-andaman px-24 py-12 text-white">{copy.list} →</Link><Link href="/property/listings" className="rounded-lg border border-border-line px-24 py-12">{copy.listings}</Link></div>
      <h2 className="mt-40 font-display text-heading-2">{copy.strategy}</h2>
      <div className="mt-16 grid gap-12 md:grid-cols-3">{[{title: copy.short, offers: 'short_stay'}, {title: copy.monthly, offers: 'monthly,yearly'}, {title: copy.both, offers: 'short_stay,monthly,yearly'}].map(item => <Link key={item.offers} href={'/property/onboard?offers=' + item.offers} className="rounded-xl border border-border-line bg-surface-paper p-24 text-brand-andaman">{item.title} →</Link>)}</div>
      <div className="mt-24 grid gap-12 md:grid-cols-2"><Link href="/property/onboard?kind=home&offers=short_stay,monthly,yearly&operatingModel=owner_direct" className="rounded-xl border border-border-line bg-surface-paper p-24">{copy.owner} →</Link><Link href="/property/onboard?kind=home&offers=short_stay,monthly,yearly&operatingModel=via_management_company" className="rounded-xl border border-border-line bg-surface-paper p-24">{copy.company} →</Link></div>
      <p className="mt-24 max-w-3xl text-small text-text-secondary">{copy.responsibility}</p>
      <Link href="/manage" className="mt-20 inline-flex min-h-44 items-center text-brand-andaman">{copy.request} →</Link>
    </section>
    <LeadFormSection audience={leadAudience} initialMessage={copy.listingMessage} />
  </main>;
}
