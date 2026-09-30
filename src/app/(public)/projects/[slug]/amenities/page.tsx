import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { listPublicProjectAmenities } from '@/modules/projects';

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

  const amenities = await listPublicProjectAmenities(prisma, project.id);
  const groups = new Map<string, typeof amenities>();
  for (const amenity of amenities) {
    const key = amenity.categoryKey || 'other';
    groups.set(key, [...(groups.get(key) || []), amenity]);
  }

  return <main className="min-h-screen bg-surface-ivory">
    <header className="border-b border-border-line bg-surface-paper px-24 py-32">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.slug}`} className="text-small font-semibold text-brand-andaman hover:underline">← {project.name}</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">Amenities & facilities</h1>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">
          Everything available inside {project.name}, including access, opening hours, booking requirements and usage rules.
        </p>
      </div>
    </header>

    <div className="mx-auto max-w-6xl space-y-40 px-24 py-40">
      {[...groups.entries()].map(([group, rows]) => (
        <section key={group}>
          <h2 className="mb-16 font-display text-heading-2 font-semibold text-text-ink">{human(group)}</h2>
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(amenity => (
              <Link key={amenity.id} href={`/projects/${project.slug}/amenities/${amenity.slug}`} className="overflow-hidden rounded-xl border border-border-line bg-surface-paper transition hover:shadow-card">
                {amenity.coverUrl ? (
                  <Image src={amenity.coverUrl} alt={amenity.name} width={720} height={420} className="aspect-video w-full object-cover" />
                ) : <div className="aspect-video bg-surface-muted" />}
                <div className="p-16">
                  <h3 className="font-semibold text-text-ink">{amenity.name}</h3>
                  {amenity.shortDescription ? <p className="mt-8 text-small text-text-secondary">{amenity.shortDescription}</p> : null}
                  <div className="mt-12 flex flex-wrap gap-6 text-micro text-text-secondary">
                    <span className="rounded-full bg-surface-ivory px-8 py-4">{amenity.pricingType === 'free' ? 'Free' : amenity.pricingType === 'included' ? 'Included' : human(amenity.pricingType)}</span>
                    {amenity.bookingRequired ? <span className="rounded-full bg-surface-ivory px-8 py-4">Booking required</span> : null}
                    {amenity.accessType !== 'open' ? <span className="rounded-full bg-surface-ivory px-8 py-4">{human(amenity.accessType)}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!amenities.length ? <p className="text-body text-text-secondary">No published amenities yet.</p> : null}
    </div>
  </main>;
}
