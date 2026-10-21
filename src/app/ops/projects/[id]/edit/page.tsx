import { getLabels } from '@/lib/i18n';
import {
  PROPERTY_EDITOR_DEFAULTS,
  PROPERTY_EDITOR_DRAFTS,
  editorLabel,
} from '@/modules/content/property-editor.seed';
import Link from 'next/link';
import ManagedGallery from '@/components/property/ManagedGallery';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import ProjectFactsForm from './project-facts-form';
export const dynamic = 'force-dynamic';
export default async function EditProjectFactsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops');
  const assigned = await prisma.roleAssignment.findFirst({
    where: {
      identityId: user.identityId,
      role: 'staff_ops',
      scopeType: 'project',
      status: 'active',
      projectId: params.id,
    },
    select: { id: true },
  });
  if (!user.isAdmin && !assigned) notFound();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      brand: true,
      address: true,
      city: true,
      district: true,
      projectType: true,
      totalUnits: true,
      updatedAt: true,
      status: true,
    },
  });
  if (!project) notFound();
  const copy = await getLabels(PROPERTY_EDITOR_DEFAULTS, undefined, PROPERTY_EDITOR_DRAFTS);
  const l = (key: string) => editorLabel(copy, key);
  return (
    <main className="stitch-workspace px-16 py-32 md:px-32">
      <div className="mx-auto max-w-4xl">
        <Link href="/mc/portfolio" className="text-brand-andaman">
          {l('back')}
        </Link>
        <h1 className="mt-12 font-display text-display-xl text-text-ink">
          {l('edit').replace('{name}', project.name)}
        </h1>
        <ProjectFactsForm
          project={{ ...project, updatedAt: project.updatedAt.toISOString() }}
          copy={copy}
        />
        <ManagedGallery scope="project" id={project.id} copy={copy} />
      </div>
    </main>
  );
}
