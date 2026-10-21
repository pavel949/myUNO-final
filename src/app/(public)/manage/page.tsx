import Link from 'next/link';
import { INQUIRY_COPY } from '@/modules/content/inquiry-copy';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { supplierCopy } from '@/modules/onboarding/supplier-copy';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { getDestination } from '@/modules/destinations';
const managementInquirySource = 'owner_management';
const leadAudience = 'owners' as const;
const destination = getDestination();
export const metadata = { title: `Property management in ${destination.name} | myUNO` };
export default async function ManagePage() {
  const locale = getRequestLocale();
  const copy = supplierCopy(locale);
  const journey = await getLabels(Object.fromEntries(Object.entries(INQUIRY_COPY).filter(([key]) => key.startsWith('audience.management.')).map(([key, value]) => [key, value.en])), locale, INQUIRY_COPY);
  return <main className="stitch-workspace">
    <section className="mx-auto max-w-content px-20 py-56">
      <h1 className="max-w-3xl font-display text-display-xl font-semibold text-text-ink">{copy.managementTitle}</h1>
      <p className="mt-16 max-w-3xl text-body text-text-secondary">{copy.managementBody}</p>
      <div className="mt-24 flex flex-wrap gap-12"><Link href="#lead-form" className="rounded-lg bg-brand-andaman px-24 py-12 text-white">{copy.request} →</Link><Link href="/rent-out" className="rounded-lg border border-border-line px-24 py-12">{copy.onlyList}</Link></div>
      <p className="mt-24 max-w-3xl text-small text-text-secondary">{copy.requestBody}</p>
    </section>
    <section id="process" className="mx-auto max-w-content scroll-mt-96 px-20 pb-48 md:px-32">
      <h2 className="font-display text-heading-2 font-semibold text-text-ink">{journey['audience.management.how']}</h2>
      <ol className="mt-16 grid list-decimal gap-16 pl-24 text-body text-text-secondary md:grid-cols-3 md:gap-32">
        {[1, 2, 3].map(step => <li key={step}>{journey[`audience.management.step${step}`]}</li>)}
      </ol>
    </section>
    <LeadFormSection audience={leadAudience} initialMessage={copy.managementMessage} sourceMedium={managementInquirySource} />
  </main>;
}
