import Link from 'next/link';
import { getRequestLocale } from '@/lib/i18n';
import { supplierCopy } from '@/modules/onboarding/supplier-copy';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { getDestination } from '@/modules/destinations';
const leadAudience = 'owners' as const;
const destination = getDestination();
export const metadata = { title: `Property management in ${destination.name} | myUNO` };
export default async function ManagePage() {
  const copy = supplierCopy(getRequestLocale());
  return <main className="stitch-workspace">
    <section className="mx-auto max-w-content px-20 py-56">
      <h1 className="max-w-3xl font-display text-display-xl font-semibold text-text-ink">{copy.managementTitle}</h1>
      <p className="mt-16 max-w-3xl text-body text-text-secondary">{copy.managementBody}</p>
      <div className="mt-24 flex flex-wrap gap-12"><Link href="#lead-form" className="rounded-lg bg-brand-andaman px-24 py-12 text-white">{copy.request} →</Link><Link href="/rent-out" className="rounded-lg border border-border-line px-24 py-12">{copy.onlyList}</Link></div>
      <p className="mt-24 max-w-3xl text-small text-text-secondary">{copy.requestBody}</p>
    </section>
    <LeadFormSection audience={leadAudience} initialMessage={copy.managementMessage} />
  </main>;
}
