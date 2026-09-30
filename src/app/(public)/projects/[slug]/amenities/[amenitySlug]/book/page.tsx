import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getPublicProjectAmenityBySlug } from '@/modules/projects';
import AmenityBookingClient from '@/components/projects/AmenityBookingClient';

export const dynamic = 'force-dynamic';

export default async function AmenityBookingPage({
  params,
  searchParams,
}: {
  params: { slug: string; amenitySlug: string };
  searchParams?: { bookingId?: string };
}) {
  const next = `/projects/${params.slug}/amenities/${params.amenitySlug}/book${searchParams?.bookingId ? `?bookingId=${encodeURIComponent(searchParams.bookingId)}` : ''}`;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(next));

  const data = await getPublicProjectAmenityBySlug(prisma, params.slug, params.amenitySlug);
  if (!data) notFound();
  if (!data.amenity.bookingRequired || !['time_slot','request','reception'].includes(data.amenity.bookingMode)) notFound();

  const labels = await getLabels({
    'amenity_booking.back': 'Back to amenity',
    'amenity_booking.title': 'Reserve {amenity}',
    'amenity_booking.new': 'Choose a time',
    'amenity_booking.policy': '{slot}-minute slots · minimum lead {lead} min · up to {days} days ahead',
    'amenity_booking.start': 'Start time',
    'amenity_booking.duration': 'Duration',
    'amenity_booking.minutes': '{count} minutes',
    'amenity_booking.party': 'Party size',
    'amenity_booking.note': 'Note (optional)',
    'amenity_booking.submit': 'Reserve',
    'amenity_booking.saving': 'Checking…',
    'amenity_booking.upcoming': 'Your upcoming reservations',
    'amenity_booking.party_count': '{count} guest(s)',
    'amenity_booking.cancel': 'Cancel',
    'amenity_booking.none': 'No upcoming reservations for this amenity.',
    'amenity_booking.confirmed': 'Reservation confirmed.',
    'amenity_booking.requested': 'Reservation request sent.',
    'amenity_booking.cancelled': 'Reservation cancelled.',
    'amenity_booking.invalid_time': 'Choose a valid start time.',
    'amenity_booking.error': 'Could not reserve this amenity.',
  });

  const policy = data.amenity.reservationConfig && typeof data.amenity.reservationConfig === 'object' && !Array.isArray(data.amenity.reservationConfig)
    ? data.amenity.reservationConfig as Record<string, number | boolean>
    : {};

  return <main className="min-h-screen bg-surface-ivory px-24 py-32">
    <div className="mx-auto max-w-5xl">
      <Link href={`/projects/${data.project.slug}/amenities/${data.amenity.slug}`} className="text-small font-semibold text-brand-andaman hover:underline">← {labels['amenity_booking.back']}</Link>
      <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['amenity_booking.title'].replace('{amenity}', data.amenity.name)}</h1>
      <p className="mt-6 mb-24 text-body text-text-secondary">{data.amenity.shortDescription}</p>
      <AmenityBookingClient
        amenityId={data.amenity.id}
        bookingId={searchParams?.bookingId}
        policy={policy}
        capacity={data.amenity.capacity}
        labels={labels}
      />
    </div>
  </main>;
}
