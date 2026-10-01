import Image from 'next/image';
import Link from 'next/link';

export type PublicProjectAmenity = {
  id: string;
  slug: string;
  name: string;
  categoryKey: string | null;
  shortDescription: string | null;
  description: string | null;
  iconKey: string | null;
  locationLabel: string | null;
  accessType: string;
  accessInstructions: string | null;
  bookingRequired: boolean;
  bookingMode: string;
  bookingUrl: string | null;
  pricingType: string;
  priceThb: number | null;
  capacity: number | null;
  minAge: number | null;
  openingHours: unknown;
  rules: unknown;
  terms: string | null;
  isFeatured: boolean;
  coverUrl: string | null;
  galleryUrls: string[];
};

function human(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function priceLabel(amenity: PublicProjectAmenity, labels: { included: string; free: string }) {
  if (amenity.pricingType === 'included') return labels.included;
  if (amenity.pricingType === 'free') return labels.free;
  if (amenity.priceThb !== null) return `฿${Math.round(amenity.priceThb / 100).toLocaleString()}`;
  return human(amenity.pricingType);
}

export default function ProjectAmenitiesSection({
  projectSlug,
  amenities,
  title,
  viewAllLabel,
  viewAllHref,
  detailHrefFor,
  labels,
  bookingId,
}: {
  projectSlug: string;
  amenities: PublicProjectAmenity[];
  title: string;
  viewAllLabel: string;
  viewAllHref?: string;
  detailHrefFor?: (amenity: PublicProjectAmenity) => string;
  labels: {
    kicker: string;
    included: string;
    free: string;
    bookingRequired: string;
  };
  bookingId?: string | null;
}) {
  if (!amenities.length) return null;
  const featured = amenities.filter(item => item.isFeatured);
  const visible = (featured.length ? featured : amenities).slice(0, 8);

  return (
    <section className="mx-auto max-w-6xl px-24 py-48 md:py-64" id="amenities">
      <div className="mb-24 flex flex-wrap items-end justify-between gap-12">
        <div>
          <p className="text-kicker font-semibold uppercase text-brand-andaman">{labels.kicker}</p>
          <h2 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{title}</h2>
        </div>
        <Link
          href={viewAllHref ?? `/projects/${projectSlug}/amenities`}
          className="font-semibold text-brand-andaman hover:underline"
        >
          {viewAllLabel}
        </Link>
      </div>

      <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((amenity) => (
          <Link
            key={amenity.id}
            href={detailHrefFor ? detailHrefFor(amenity) : `/projects/${projectSlug}/amenities/${amenity.slug}${bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : ''}`}
            className="overflow-hidden rounded-xl border border-border-line bg-surface-paper transition hover:shadow-card"
          >
            {amenity.coverUrl ? (
              <Image
                src={amenity.coverUrl}
                alt={amenity.name}
                width={640}
                height={360}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="aspect-video bg-surface-muted" />
            )}
            <div className="p-16">
              {amenity.categoryKey ? (
                <p className="text-micro uppercase text-brand-andaman">{human(amenity.categoryKey)}</p>
              ) : null}
              <h3 className="mt-4 font-semibold text-text-ink">{amenity.name}</h3>
              {amenity.shortDescription ? (
                <p className="mt-8 line-clamp-3 text-small text-text-secondary">{amenity.shortDescription}</p>
              ) : null}
              <div className="mt-12 flex flex-wrap gap-8 text-micro text-text-secondary">
                <span className="rounded-full bg-surface-ivory px-8 py-4">{priceLabel(amenity, labels)}</span>
                {amenity.bookingRequired ? (
                  <span className="rounded-full bg-surface-ivory px-8 py-4">{labels.bookingRequired}</span>
                ) : null}
                {amenity.accessType !== 'open' ? (
                  <span className="rounded-full bg-surface-ivory px-8 py-4">{human(amenity.accessType)}</span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
