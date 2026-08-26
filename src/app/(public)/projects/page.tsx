import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels } from '@/lib/i18n';
import { listPublicProjects } from '@/modules/projects';
import { t } from '@/modules/content';
import { prisma } from '@/lib/prisma';
import { getRequestLocale } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { satangToThb } from './satang-to-thb';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'projects.meta.title': 'Our residences in Phuket | myUNO',
    'projects.meta.description':
      'Explore the residences we operate: serviced homes with verified guests, managed operations, and full owner transparency.',
  });
  return {
    title: labels['projects.meta.title'],
    description: labels['projects.meta.description'],
    alternates: publicPageAlternates('/projects'),
  };
}

export default async function ProjectsHubPage() {
  const labels = await getLabels({
    'projects.hub.kicker': 'Where we operate',
    'projects.hub.title': 'Our residences',
    'projects.hub.subtitle':
      'Every residence on myUNO runs on one platform: verified guests, managed services, transparent owner reporting.',
    'projects.hub.units_live': '{count} homes available',
    'projects.hub.from_price': 'from ฿{price} / night',
    'projects.hub.view': 'Explore the residence →',
    'projects.hub.empty': 'Residences are being prepared for launch.',
    'projects.hub.empty_hint': 'Check back soon, or search available stays directly.',
    'projects.hub.search_cta': 'Search stays',
  });

  const projects = await listPublicProjects();
  const locale = getRequestLocale();

  // Resolve each project's area label (a content key on the project row).
  const areaLabels = new Map<string, string>();
  await Promise.all(
    projects.map(async (p) => {
      try {
        const v = await t(prisma, p.areaLabelKey, undefined, locale);
        areaLabels.set(p.id, v && v !== p.areaLabelKey && v !== '—' ? v : '');
      } catch {
        areaLabels.set(p.id, '');
      }
    })
  );

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-small mb-16">{labels['projects.hub.kicker']}</p>
          <h1 className="text-heading-1 font-bold mb-16">{labels['projects.hub.title']}</h1>
          <p className="text-body text-surface-ivory/90">{labels['projects.hub.subtitle']}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto py-64 px-24">
        {projects.length === 0 ? (
          <div className="text-center py-64">
            <p className="text-heading-2 font-bold text-text-ink mb-12">
              {labels['projects.hub.empty']}
            </p>
            <p className="text-body text-text-secondary mb-32">
              {labels['projects.hub.empty_hint']}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center justify-center bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
            >
              {labels['projects.hub.search_cta']}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-32">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="bg-white border border-border-line rounded-lg overflow-hidden hover:shadow-lg transition"
              >
                {project.coverUrl ? (
                  <Image
                    src={project.coverUrl}
                    alt={project.name}
                    width={640}
                    height={224}
                    className="w-full h-56 object-cover"
                  />
                ) : (
                  <div className="w-full h-56 bg-surface-background" />
                )}
                <div className="p-32">
                  <h2 className="text-heading-2 font-bold text-text-ink mb-8">
                    {project.name}
                  </h2>
                  {areaLabels.get(project.id) ? (
                    <p className="text-small text-text-secondary mb-16">
                      {areaLabels.get(project.id)}
                    </p>
                  ) : null}
                  <p className="text-body text-text-secondary mb-8">
                    {labels['projects.hub.units_live'].replace(
                      '{count}',
                      String(project.liveUnitCount)
                    )}
                  </p>
                  {project.fromNightlyThb !== null ? (
                    <p className="text-body text-text-ink font-semibold mb-16">
                      {labels['projects.hub.from_price'].replace(
                        '{price}',
                        satangToThb(project.fromNightlyThb)
                      )}
                    </p>
                  ) : null}
                  <span className="text-brand-andaman font-semibold">
                    {labels['projects.hub.view']}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
