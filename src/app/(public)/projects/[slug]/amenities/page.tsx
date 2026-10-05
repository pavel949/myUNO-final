import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { listPublicProjectAmenities } from '@/modules/projects';
import { getLabels, getRequestLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

function human(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default async function ProjectAmenitiesPage({ params }: { params: { slug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!project || project.status !== 'live') notFound();

  const labels = await getLabels({
    'project_amenities.back': 'Back to project',
    'project_amenities.title': 'Amenities & facilities',
    'project_amenities.body': 'Everything available inside {project}, including access, opening hours, booking requirements and usage rules.',
    'project_amenities.free': 'Free',
    'project_amenities.included': 'Included',
    'project_amenities.booking_required': 'Booking required',
    'project_amenities.empty': 'No published amenities yet.',
  });
  const amenities = await listPublicProjectAmenities(prisma, project.id, getRequestLocale());
  const groups = new Map<string, typeof amenities>();
  for (const amenity of amenities) {
    const key = amenity.categoryKey || 'other';
    groups.set(key, [...(groups.get(key) || []), amenity]);
  }

  return <main className="min-h-screen bg-surface-ivory">
    <header className="border-b border-border-line bg-surface-paper px-24 py-32">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.slug}`} className="text-small font-semibold text-brand-andaman hover:underline">← {labels['project_amenities.back']} · {project.name}</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['project_amenities.title']}</h1>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">
          {labels['project_amenities.body'].replace('{project}', project.name)}
        </p>
      </div>
    </header>

    <div className="mx-auto max-w-6xl space-y-40 px-24 py-40">
      {[...groups.entries()].map(([group, rows]) => (
        <section key={group}>
          <h2 className="mb-16 font-display text-heading-2 font-semibold text-text-ink">{human(group)}</h2>
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(amenity => (
              <Link key={amenity.id} href={`/projects/${project.slug}/amenities/${amenity.slug}`} className="overflow-hidden rounded-md border border-border-line bg-surface-paper transition hover:shadow-card">
                {amenity.coverUrl ? (
                  <Image src={amenity.coverUrl} alt={amenity.name} width={720} height={420} className="aspect-video w-full object-cover" />
                ) : <div className="aspect-video bg-surface-muted" />}
                <div className="p-16">
                  <h3 className="font-semibold text-text-ink">{amenity.name}</h3>
                  {amenity.shortDescription ? <p className="mt-8 text-small text-text-secondary">{amenity.shortDescription}</p> : null}
                  <div className="mt-12 flex flex-wrap gap-8 text-small text-text-secondary">
                    <span className="rounded-full bg-surface-ivory px-8 py-4">{amenity.pricingType === 'free' ? labels['project_amenities.free'] : amenity.pricingType === 'included' ? labels['project_amenities.included'] : human(amenity.pricingType)}</span>
                    {amenity.bookingRequired ? <span className="rounded-full bg-surface-ivory px-8 py-4">{labels['project_amenities.booking_required']}</span> : null}
                    {amenity.accessType !== 'open' ? <span className="rounded-full bg-surface-ivory px-8 py-4">{human(amenity.accessType)}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!amenities.length ? <p className="text-body text-text-secondary">{labels['project_amenities.empty']}</p> : null}
    </div>
  </main>;
}
