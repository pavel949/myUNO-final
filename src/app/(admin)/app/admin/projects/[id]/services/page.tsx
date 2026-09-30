import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ProjectServicesClient from './project-services-client';

export const dynamic = 'force-dynamic';

export default async function ProjectServicesPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/app/admin/projects/' + params.id + '/services'));
  if (!user.isAdmin) redirect('/');

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!project) notFound();

  const services = await prisma.service.findMany({
    where: { status: 'active', provider: { status: 'active', vetted_at: { not: null } } },
    select: {
      id: true,
      title: true,
      categoryKey: true,
      provider: { select: { name: true } },
      availableProjects: {
        select: { project_id: true, enabled: true, public: true },
      },
    },
    orderBy: [{ categoryKey: 'asc' }, { title: 'asc' }],
  });

  const labels = await getLabels({
    'admin.project_services.title': 'Project services',
    'admin.project_services.body': 'Choose which restricted myUNO services are available in this Project Space. Services with no project restrictions are available platform-wide.',
    'admin.project_services.back': 'Back to Project 360',
    'admin.project_services.global': 'Global myUNO service · available in every project',
    'admin.project_services.restricted_here': 'Restricted service · available in {count} project(s), including this one',
    'admin.project_services.restricted_elsewhere': 'Restricted service · currently assigned to {count} other project(s)',
    'admin.project_services.add': 'Add to this project',
    'admin.project_services.remove': 'Remove from this project',
    'admin.project_services.enable': 'Enable',
    'admin.project_services.disable': 'Disable',
    'admin.project_services.show': 'Show publicly',
    'admin.project_services.hide': 'Hide publicly',
    'admin.project_services.make_global': 'Make global',
    'admin.project_services.global_confirm': 'Make this service available across every myUNO project?',
    'admin.project_services.error': 'Could not update project service availability.',
  });

  const rows = services.map(service => {
    const here = service.availableProjects.find(row => row.project_id === project.id);
    return {
      id: service.id,
      title: service.title,
      providerName: service.provider.name,
      categoryKey: service.categoryKey,
      scope: service.availableProjects.length === 0 ? 'global' as const
        : here ? 'restricted_here' as const : 'restricted_elsewhere' as const,
      projectCount: service.availableProjects.length,
      enabledHere: here?.enabled ?? null,
      publicHere: here?.public ?? null,
    };
  });

  return <main className="mx-auto max-w-5xl p-24 md:p-32">
    <Link href={`/app/admin/projects/${project.id}`} className="text-small font-semibold text-brand-andaman hover:underline">
      ← {labels['admin.project_services.back']}
    </Link>
    <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['admin.project_services.title']} · {project.name}</h1>
    <p className="mt-8 mb-24 max-w-3xl text-body text-text-secondary">{labels['admin.project_services.body']}</p>
    <ProjectServicesClient projectId={project.id} services={rows} labels={labels} />
  </main>;
}
