import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

/**
 * Shared shape for the audience landing pages (guests, developers, buyers,
 * management companies, providers). Copy comes from the `audience.*` content
 * keys (RU/EN/TH in the DB); the drafts here are the EN fallbacks used only
 * when a key is missing (doc 05 §1). The owners page has its own richer page.
 */
export interface AudienceCopy {
  /** Key slug, e.g. 'guests' → audience.guests.title / .subtitle / .cta */
  slug: 'guests' | 'developers' | 'buyers' | 'mc' | 'providers';
  titleDraft: string;
  subtitleDraft: string;
  ctaDraft: string;
  /** Where the CTA button leads (e.g. /search, /register, mailto:…). */
  ctaHref: string;
}

async function audienceLabels(copy: AudienceCopy) {
  return getLabels({
    [`audience.${copy.slug}.title`]: copy.titleDraft,
    [`audience.${copy.slug}.subtitle`]: copy.subtitleDraft,
    [`audience.${copy.slug}.cta`]: copy.ctaDraft,
  } as Record<string, string>);
}

export async function audienceMetadata(copy: AudienceCopy): Promise<Metadata> {
  const labels = await audienceLabels(copy);
  return {
    title: `${labels[`audience.${copy.slug}.title`]} | myUNO`,
    description: labels[`audience.${copy.slug}.subtitle`],
  };
}

export async function AudiencePage({ copy }: { copy: AudienceCopy }) {
  const labels = await audienceLabels(copy);
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">
            {labels[`audience.${copy.slug}.title`]}
          </h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels[`audience.${copy.slug}.subtitle`]}
          </p>
          <Link
            href={copy.ctaHref}
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels[`audience.${copy.slug}.cta`]} →
          </Link>
        </div>
      </section>
    </main>
  );
}
