import Link from 'next/link';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { INQUIRY_COPY } from '@/modules/content/inquiry-copy';
import { LeadFormSection } from '@/app/(public)/lead-form-section';

export const dynamic = 'force-dynamic';
const inquirySource = 'homepage_choice';
const inquiryAudience = 'renters' as const;

export default async function ChooseHelpPage() {
  const locale = getRequestLocale();
  const copy = await getLabels(Object.fromEntries(Object.entries(INQUIRY_COPY).map(([key, value]) => [key, value.en])), locale, INQUIRY_COPY);
  return <main>
    <section className="mx-auto max-w-content px-20 py-48 md:px-32">
      <h1 className="max-w-3xl font-display text-display-xl font-semibold text-text-ink">{copy['audience.choice.title']}</h1>
      <p className="mt-16 max-w-3xl text-body text-text-secondary">{copy['audience.choice.body']}</p>
      <Link href="/manage" className="mt-24 inline-flex min-h-44 items-center font-semibold text-brand-andaman hover:underline">{copy['audience.choice.manage']} →</Link>
    </section>
    <LeadFormSection audience={inquiryAudience} chooseAudience sourceMedium={inquirySource} />
  </main>;
}
