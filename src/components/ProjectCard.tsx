import Image from 'next/image';
import Link from 'next/link';
import type { PublicProjectCard as PublicProject } from '@/modules/projects/public.service';
import { projectPresentationImage } from '@/lib/presentation-media';

export interface ProjectCardLabels {
  homes: string;
  fromPrice?: string;
  noPhoto: string;
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
      className={`group relative overflow-hidden rounded-2xl bg-brand-deep ${featured ? 'md:col-span-2 md:row-span-2 min-h-[520px]' : 'min-h-[250px]'}`}
    >
      <Image
        src={image.src}
        alt={image.illustrative ? '' : project.name}
        fill
        className="object-cover transition duration-700 group-hover:scale-[1.03]"
      />
      {image.illustrative ? (
        <span className="absolute right-16 top-16 z-10 rounded-full bg-black/35 px-10 py-6 text-small text-white/80 backdrop-blur">
          {labels.noPhoto}
        </span>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-24 text-white">
        <p className="text-small text-white/70">
          {labels.homes.replace('{count}', String(project.liveUnitCount))}
        </p>
        <h3 className={`font-display font-semibold mt-4 ${featured ? 'text-display' : 'text-heading-2'}`}>
          {project.name}
        </h3>
        {labels.fromPrice && project.fromNightlyThb !== null ? (
          <p className="mt-8 text-small text-white/80">
            {labels.fromPrice.replace('{price}', Math.round(project.fromNightlyThb / 100).toLocaleString())}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
