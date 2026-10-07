import Link from 'next/link';
import { StitchMain, PublicHero } from '@/components/premium/StitchPage';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { listBrowsableAreas } from '@/modules/projects';
import { t } from '@/modules/content';
import { EmptyState } from '@/components/premium/PremiumPrimitives';
import { getDestination } from '@/modules/destinations';

export const dynamic = 'force-dynamic';

export default async function AreasPage() {
  const locale = getRequestLocale();
  const destination = getDestination();
  const [areas, labels] = await Promise.all([
    listBrowsableAreas(prisma),
    getLabels({
      'areas.kicker': `${destination.name.toUpperCase()} BY AREA`,
      'areas.title': `Find the part of ${destination.name} that fits you.`,
      'areas.body': 'Browse live myUNO projects by their canonical area. An area appears only when it contains public inventory.',
      'areas.projects': '{count} projects',
      'areas.open': 'Explore area',
      'areas.empty_title': 'Area discovery is being prepared.',
      'areas.empty_body': 'Projects remain available through the main collection while canonical area assignments are completed.',
      'areas.empty_cta': 'Explore projects',
    }),
  ]);

  const resolved = await Promise.all(
    areas.map(async (area) => {
      const name = await t(prisma, area.nameKey, undefined, locale).catch(() => area.slug);
      const description = area.descriptionKey
        ? await t(prisma, area.descriptionKey, undefined, locale).catch(() => '')
        : '';
      return {
        ...area,
        displayName: name && name !== area.nameKey && name !== '—' ? name : area.slug,
        description: description && description !== area.descriptionKey && description !== '—' ? description : '',
      };
    })
  );

  return (
    <StitchMain>
      <PublicHero dark kicker={labels['areas.kicker']} title={labels['areas.title']} body={labels['areas.body']} />
      <section>
        {resolved.length ? (
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {resolved.map((area) => (
              <Link
                key={area.id}
                href={`/areas/${area.slug}`}
                className="group stitch-panel flex min-h-[240px] min-w-0 flex-col justify-between p-24 transition-shadow duration-structural hover:shadow-float"
              >
                <div>
                  <p className="text-small font-semibold text-brand-andaman">
                    {labels['areas.projects'].replace('{count}', String(area.projectCount))}
                  </p>
                  <h2 className="mt-8 font-display text-display font-semibold tracking-[-0.02em] text-text-ink">
                    {area.displayName}
                  </h2>
                  {area.description ? (
                    <p className="mt-12 line-clamp-3 text-body text-text-secondary">{area.description}</p>
                  ) : null}
                </div>
                <span className="mt-24 text-small font-semibold text-brand-andaman transition-transform group-hover:translate-x-4">
                  {labels['areas.open']} →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={labels['areas.empty_title']}
            body={labels['areas.empty_body']}
            action={
              <Link href="/projects" className="font-semibold text-brand-andaman hover:underline">
                {labels['areas.empty_cta']} →
              </Link>
            }
          />
        )}
      </section>
    </StitchMain>
  );
}
