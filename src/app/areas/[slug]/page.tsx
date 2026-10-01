import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getAreaForBrowse, listPublicProjects } from '@/modules/projects';
import { t } from '@/modules/content';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState, RecordPageHeader } from '@/components/premium/PremiumPrimitives';

export const dynamic = 'force-dynamic';

export default async function AreaDetailPage({ params }: { params: { slug: string } }) {
  const locale = getRequestLocale();
  const area = await getAreaForBrowse(prisma, params.slug);
  if (!area) notFound();

  const [labels, publicProjects, areaName, areaDescription] = await Promise.all([
    getLabels({
      'area.back': 'Phuket areas',
      'area.projects': '{count} public projects',
      'area.children': 'Explore nearby areas',
      'area.collection': 'Projects in this area',
      'area.search': 'Search stays here',
      'area.all_projects': 'All projects',
      'area.empty_title': 'No public projects are available here yet.',
      'area.empty_body': 'The area remains visible for navigation, but its projects are not currently public.',
      'landing.collection.homes': '{count} homes',
      'landing.collection.from_price': 'From ฿{price} / night',
      'landing.collection.no_photo': 'Illustrative image',
      'landing.collection.view': 'Explore',
    }),
    listPublicProjects(),
    t(prisma, area.area.nameKey, undefined, locale).catch(() => area.area.slug),
    area.area.descriptionKey
      ? t(prisma, area.area.descriptionKey, undefined, locale).catch(() => '')
      : Promise.resolve(''),
  ]);

  const projectIds = new Set(area.projects.map((project) => project.id));
  const projects = publicProjects.filter((project) => projectIds.has(project.id));

  const children = await Promise.all(
    area.children.map(async (child) => ({
      ...child,
      label: await t(prisma, child.nameKey, undefined, locale).catch(() => child.slug),
    }))
  );

  const title = areaName && areaName !== area.area.nameKey && areaName !== '—' ? areaName : area.area.slug;
  const description =
    areaDescription && areaDescription !== area.area.descriptionKey && areaDescription !== '—'
      ? areaDescription
      : null;

  return (
    <main className="min-h-screen bg-surface-ivory">
      <RecordPageHeader
        eyebrow={<Link href="/areas" className="hover:text-brand-andaman">{labels['area.back']}</Link>}
        title={title}
        subtitle={description || labels['area.projects'].replace('{count}', String(projects.length))}
        chips={
          <>
            <span className="text-small font-semibold text-brand-andaman">
              {labels['area.projects'].replace('{count}', String(projects.length))}
            </span>
          </>
        }
        actions={
          <>
            <Link
              href={`/search?areaSlug=${encodeURIComponent(area.area.slug)}`}
              className="inline-flex min-h-48 items-center rounded-lg bg-brand-andaman px-20 text-small font-semibold text-white hover:bg-brand-deep"
            >
              {labels['area.search']}
            </Link>
            <Link
              href="/projects"
              className="inline-flex min-h-48 items-center rounded-lg border border-border-line bg-surface-paper px-20 text-small font-semibold text-text-ink hover:border-border-line-2"
            >
              {labels['area.all_projects']}
            </Link>
          </>
        }
      />

      {children.length ? (
        <section className="mx-auto max-w-7xl px-20 pt-40 md:px-32">
          <h2 className="font-display text-title font-semibold text-text-ink">{labels['area.children']}</h2>
          <div className="mt-16 flex flex-wrap gap-8">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/areas/${child.slug}`}
                className="rounded-full border border-border-line bg-surface-paper px-14 py-8 text-small font-semibold text-text-ink hover:border-border-line-2"
              >
                {child.label && child.label !== child.nameKey ? child.label : child.slug}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
        <h2 className="font-display text-display font-semibold text-text-ink">{labels['area.collection']}</h2>
        {projects.length ? (
          <div className="mt-28 grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                featured={index === 0 && projects.length > 2}
                labels={{
                  homes: labels['landing.collection.homes'],
                  fromPrice: labels['landing.collection.from_price'],
                  noPhoto: labels['landing.collection.no_photo'],
                  view: labels['landing.collection.view'],
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-24">
            <EmptyState title={labels['area.empty_title']} body={labels['area.empty_body']} />
          </div>
        )}
      </section>
    </main>
  );
}
