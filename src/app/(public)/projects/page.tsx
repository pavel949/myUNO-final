import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { listPublicProjects } from '@/modules/projects';
import { getRequestLocale } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { ProjectCard } from '@/components/ProjectCard';

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
    'projects.hub.view': 'Explore the residence',
    'projects.hub.no_photo': 'Illustrative image',
    'projects.hub.responsibility_project': 'Operations managed by {org}',
    'projects.hub.responsibility_selected': 'Selected homes managed by {org}',
    'projects.hub.empty': 'Residences are being prepared for launch.',
    'projects.hub.empty_hint': 'Check back soon, or search available stays directly.',
    'projects.hub.search_cta': 'Search stays',
  });

  const projects = await listPublicProjects(getRequestLocale()).catch(() => []);

  return (
    <main className="stitch-workspace">
      <section className="mx-auto max-w-7xl px-20 pt-32 md:px-32 md:pt-48">
        <div className="stitch-hero-dark">
          <p className="text-kicker uppercase tracking-[0.16em] text-white/70">{labels['projects.hub.kicker']}</p>
          <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.03em] text-white">{labels['projects.hub.title']}</h1>
          <p className="mt-12 max-w-3xl text-body text-white/80">{labels['projects.hub.subtitle']}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-40 md:px-32 md:py-56">
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
          <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                labels={{
                  homes: labels['projects.hub.units_live'],
                  fromPrice: labels['projects.hub.from_price'],
                  noPhoto: labels['projects.hub.no_photo'],
                  view: labels['projects.hub.view'],
                  responsibilityProject: labels['projects.hub.responsibility_project'],
                  responsibilitySelected: labels['projects.hub.responsibility_selected'],
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
