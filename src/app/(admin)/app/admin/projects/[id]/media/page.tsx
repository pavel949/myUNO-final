/* eslint-disable local-rules/no-literal-ui-text */
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getProjectExperienceActor } from '@/app/libs/projectExperienceGuard';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ScopedGalleryEditor from '@/components/property/ScopedGalleryEditor';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';

export const dynamic = 'force-dynamic';

export default async function ProjectMediaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { select?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/app/admin/projects/' + params.id + '/media'));
  const actor = await getProjectExperienceActor(params.id);
  if (!actor) redirect('/');

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true,
      inventoryCategories: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
      units: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
    },
  });
  if (!project) notFound();

  const labels = await getLabels({
    'admin.gallery.title': 'Media library',
    'admin.gallery.scope_hint': 'Choose project, category or exact unit. Each level keeps its own truthful gallery and cover.',
    'admin.gallery.level': 'Media scope',
    'admin.gallery.project': 'Project',
    'admin.gallery.category': 'Category',
    'admin.gallery.unit': 'Exact unit',
    'admin.gallery.object': 'Object',
    'admin.gallery.photos': 'photos',
    'admin.gallery.hint': 'Upload, select cover and reorder. Shared assets are unlinked safely when removed.',
    'admin.gallery.add': 'Add photos',
    'admin.gallery.saving': 'Saving…',
    'admin.gallery.saved': 'Gallery saved.',
    'admin.gallery.loading': 'Loading gallery…',
    'admin.gallery.empty': 'No photos at this level yet.',
    'admin.gallery.cover': 'Cover',
    'admin.gallery.set_cover': 'Set cover',
    'admin.gallery.remove': 'Remove',
    'admin.gallery.safe_remove': 'Removing a photo from this gallery does not delete a shared MediaAsset used elsewhere.',
  });

  return <main className="mx-auto max-w-7xl p-24 md:p-32">
    <ProjectWorkspaceNav projectId={project.id} active={'media'} contentOnly={!actor.isAdmin} />
    <div className="mb-24">
      <p className="text-kicker uppercase text-brand-andaman">Project Media</p>
      <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">{project.name}</h1>
      <p className="mt-8 max-w-3xl text-body text-text-secondary">One workspace for project, category and exact-unit galleries. Amenity-specific photos are managed inside Experience so their context is never lost.</p>
    </div>
    <ScopedGalleryEditor
      projectId={project.id}
      projectName={project.name}
      categories={project.inventoryCategories}
      units={project.units}
      initialSelection={searchParams?.select}
      labels={labels}
    />
  </main>;
}
