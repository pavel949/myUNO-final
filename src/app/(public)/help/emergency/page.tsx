import Link from 'next/link';
import { StitchMain } from '@/components/premium/StitchPage';
import { getLabels } from '@/lib/i18n';
import { getDestination } from '@/modules/destinations';
import { GALLERY_EMERGENCY_KEYS, GALLERY_EMERGENCY_LOCALE_DRAFTS } from '@/modules/content/gallery-emergency.seed';
import { THAILAND_EMERGENCY_CONTACTS } from './contacts';

export const dynamic = 'force-dynamic';

/** Public guidance remains reachable without account, booking or commerce. */
export default async function EmergencyHelpPage() {
  const labels = await getLabels(Object.fromEntries(GALLERY_EMERGENCY_KEYS.filter(row => row.namespace === 'help').map(row => [row.key, row.en])), undefined, GALLERY_EMERGENCY_LOCALE_DRAFTS);
  const contacts = getDestination().countryCode === 'TH' ? THAILAND_EMERGENCY_CONTACTS : [];
  return <StitchMain>
    <Link href="/help" className="text-brand-andaman font-semibold hover:underline">← {labels['help.emergency.back']}</Link>
    <section className="my-24 max-w-3xl">
      <h1 className="font-display text-display font-semibold text-text-ink">{labels['help.emergency.title']}</h1>
      <p className="mt-16 text-body text-text-ink">{labels['help.emergency.body']}</p>
      <p className="mt-12 text-small text-text-secondary">{labels['help.emergency.scope']}</p>
    </section>
    <div className="grid gap-16 sm:grid-cols-2">
      {contacts.map(contact => <article key={contact.key} className="stitch-panel p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink">{labels[`help.emergency.${contact.key}`]}</h2>
        <a href={`tel:${contact.phone}`} className="my-16 inline-flex min-h-48 items-center rounded-md bg-state-error px-24 text-title font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4">{contact.phone}</a>
        <p><a href={contact.source} target="_blank" rel="noopener noreferrer" className="text-small text-brand-andaman hover:underline">{labels['help.emergency.source']}</a></p>
      </article>)}
    </div>
    <p className="my-24 max-w-3xl text-body text-text-secondary">{labels['help.emergency.details']}</p>
    <section className="stitch-panel p-24">
      <h2 className="text-heading-3 font-semibold text-text-ink">{labels['help.emergency.property_title']}</h2>
      <p className="my-16 text-body text-text-secondary">{labels['help.emergency.property_body']}</p>
      <Link href="/trips" className="text-brand-andaman font-semibold hover:underline">{labels['help.emergency.trips']} →</Link>
    </section>
  </StitchMain>;
}
