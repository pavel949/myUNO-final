import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPublicProjectAmenityBySlug } from '@/modules/projects';

export const dynamic = 'force-dynamic';

function human(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function renderJson(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map((row, i) => <li key={i}>{typeof row === 'string' ? row : JSON.stringify(row)}</li>);
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k,v]) => <li key={k}><strong>{human(k)}:</strong> {typeof v === 'string' ? v : JSON.stringify(v)}</li>);
  return <li>{String(value)}</li>;
}

export default async function AmenityDetailPage({ params }: { params: { slug: string; amenitySlug: string } }) {
  const data = await getPublicProjectAmenityBySlug(prisma, params.slug, params.amenitySlug);
  if (!data) notFound();
  const { project, amenity } = data;

  return <main className="min-h-screen bg-surface-ivory">
    <header className="border-b border-border-line bg-surface-paper px-24 py-24">
      <div className="mx-auto max-w-5xl">
        <Link href={`/projects/${project.slug}/amenities`} className="text-small font-semibold text-brand-andaman hover:underline">← All amenities</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{amenity.name}</h1>
        {amenity.shortDescription ? <p className="mt-8 text-body text-text-secondary">{amenity.shortDescription}</p> : null}
      </div>
    </header>

    <div className="mx-auto max-w-5xl px-24 py-32">
      {amenity.galleryUrls.length ? (
        <div className="grid gap-8 sm:grid-cols-2">
          {amenity.galleryUrls.map((src, i) => <Image key={src} src={src} alt={`${amenity.name} photo ${i+1}`} width={900} height={540} className="aspect-video w-full rounded-lg object-cover" />)}
        </div>
      ) : amenity.coverUrl ? <Image src={amenity.coverUrl} alt={amenity.name} width={1200} height={720} className="aspect-video w-full rounded-lg object-cover" /> : null}

      <div className="mt-32 grid gap-24 lg:grid-cols-[1fr_320px]">
        <article>
          {amenity.description ? <p className="whitespace-pre-line text-body leading-relaxed text-text-secondary">{amenity.description}</p> : null}
          {amenity.terms ? <section className="mt-24"><h2 className="font-display text-heading-2 font-semibold">Terms of use</h2><p className="mt-8 whitespace-pre-line text-body text-text-secondary">{amenity.terms}</p></section> : null}
          {amenity.rules ? <section className="mt-24"><h2 className="font-display text-heading-2 font-semibold">Rules</h2><ul className="mt-8 list-disc space-y-6 pl-20 text-body text-text-secondary">{renderJson(amenity.rules)}</ul></section> : null}
        </article>
        <aside className="rounded-xl border border-border-line bg-surface-paper p-20">
          <dl className="space-y-12 text-small">
            {amenity.locationLabel ? <div><dt className="text-text-secondary">Location</dt><dd className="font-medium">{amenity.locationLabel}</dd></div> : null}
            <div><dt className="text-text-secondary">Access</dt><dd className="font-medium">{human(amenity.accessType)}</dd></div>
            {amenity.accessInstructions ? <div><dt className="text-text-secondary">How to access</dt><dd className="font-medium">{amenity.accessInstructions}</dd></div> : null}
            <div><dt className="text-text-secondary">Cost</dt><dd className="font-medium">{amenity.pricingType === 'included' ? 'Included' : amenity.pricingType === 'free' ? 'Free' : amenity.priceThb !== null ? `฿${Math.round(amenity.priceThb/100).toLocaleString()}` : human(amenity.pricingType)}</dd></div>
            {amenity.capacity ? <div><dt className="text-text-secondary">Capacity</dt><dd className="font-medium">{amenity.capacity}</dd></div> : null}
            {amenity.minAge !== null ? <div><dt className="text-text-secondary">Minimum age</dt><dd className="font-medium">{amenity.minAge}</dd></div> : null}
            {amenity.bookingRequired ? <div><dt className="text-text-secondary">Booking</dt><dd className="font-medium">{human(amenity.bookingMode)}</dd></div> : null}
          </dl>
          {amenity.bookingRequired && amenity.bookingUrl ? <a href={amenity.bookingUrl} className="mt-20 inline-flex min-h-44 w-full items-center justify-center rounded-lg bg-brand-andaman px-16 font-semibold text-white">Book this amenity</a> : null}
        </aside>
      </div>
    </div>
  </main>;
}
