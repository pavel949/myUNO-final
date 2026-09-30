import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import ProjectExperienceClient from './project-experience-client';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';

export const dynamic = 'force-dynamic';

export default async function ProjectExperiencePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/app/admin/projects/' + params.id + '/experience'));
  if (!user.isAdmin) redirect('/');

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, slug: true,
      amenities: {
        include: {
          coverMedia: { select: { storageKey: true } },
          media: {
            orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
            include: { media: { select: { id: true, storageKey: true } } },
          },
        },
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      },
    },
  });
  if (!project) notFound();

  return <main className="mx-auto max-w-7xl p-24 md:p-32">
    <ProjectWorkspaceNav projectId={project.id} active="experience" />
    <div className="mb-24 flex flex-wrap items-start justify-between gap-16">
      <div>
        <Link href={`/app/admin/projects/${project.id}`} className="text-small font-semibold text-brand-andaman hover:underline">← Project 360</Link>
        <p className="mt-12 text-kicker uppercase text-brand-andaman">Project Experience</p>
        <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">{project.name}</h1>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">
          Manage everything guests can use inside this project: pools, gyms, cinema rooms, sauna, coworking, shuttle, clubs and any custom facility. Marketplace concierge services remain separate and global.
        </p>
      </div>
      <Link href={`/app/admin/projects/${project.id}/preview`} className="rounded-md border border-border-line px-14 py-10 font-semibold text-brand-andaman">Preview portal</Link>
    </div>
    <ProjectExperienceClient projectId={project.id} initialAmenities={project.amenities} />
  </main>;
}
