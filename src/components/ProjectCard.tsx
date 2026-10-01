import Image from 'next/image';
import Link from 'next/link';
import type { PublicProjectCard as PublicProject } from '@/modules/projects';
import { projectPresentationImage } from '@/lib/presentation-media';

export interface ProjectCardLabels {
  homes: string;
  fromPrice?: string;
  noPhoto: string;
  view?: string;
}

export function ProjectCard({
  project,
  labels,
  featured = false,
}: {
  project: PublicProject;
  labels: ProjectCardLabels;
  featured?: boolean;
}) {
  const image = projectPresentationImage(project.id, project.coverUrl);

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`group relative isolate overflow-hidden rounded-2xl bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
        featured ? 'min-h-[420px] md:col-span-2 md:row-span-2 md:min-h-[520px]' : 'min-h-[230px] md:min-h-[250px]'
      }`}
    >
      <Image
        src={image.src}
        alt={image.illustrative ? '' : project.name}
        fill
        sizes={featured ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 50vw, 33vw'}
        className="object-cover transition duration-700 group-hover:scale-[1.03]"
      />

      {image.illustrative ? (
        <span className="absolute right-16 top-16 z-10 rounded-full bg-black/40 px-12 py-4 text-small text-white/80 backdrop-blur">
          {labels.noPhoto}
        </span>
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5" />

      <div className="absolute inset-x-0 bottom-0 p-20 text-white md:p-24">
        <p className="text-small text-white/70">
          {labels.homes.replace('{count}', String(project.liveUnitCount))}
        </p>
        <h3 className={`mt-4 font-display font-semibold tracking-[-0.02em] ${
          featured ? 'text-display md:text-display-xl' : 'text-title md:text-heading-2'
        }`}>
          {project.name}
        </h3>

        {project.featuredAmenities.length > 0 ? (
          <p className="mt-8 line-clamp-1 text-small text-white/75">
            {project.featuredAmenities.slice(0, 3).map((item) => item.name).join(' · ')}
          </p>
        ) : null}

        <div className="mt-12 flex items-end justify-between gap-12">
          {labels.fromPrice && project.fromNightlyThb !== null ? (
            <p className="text-small font-semibold text-white/90">
              {labels.fromPrice.replace(
                '{price}',
                Math.round(project.fromNightlyThb / 100).toLocaleString()
              )}
            </p>
          ) : (
            <span />
          )}

          <span className="shrink-0 text-small font-semibold text-white transition-transform duration-structural group-hover:translate-x-4">
            {labels.view || 'Explore'} →
          </span>
        </div>
      </div>
    </Link>
  );
}
