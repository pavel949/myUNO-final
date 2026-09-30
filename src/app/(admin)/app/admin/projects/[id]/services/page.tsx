import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ProjectServicesClient from './project-services-client';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';

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
      basePriceThb: true,
      advanceNoticeHours: true,
      availableProjects: {
        select: {
          project_id: true, enabled: true, public: true,
          price_override_thb: true, lead_time_hours: true,
          take_rate_pct: true, terms_version: true,
        },
      },
    },
    orderBy: [{ categoryKey: 'asc' }, { title: 'asc' }],
  });

  const labels = await getLabels({
    'admin.project_services.title': 'Concierge preferences',
    'admin.project_services.body': 'myUNO marketplace services are available across all projects. Configure only optional project-specific prices, lead times or commercial preferences here.',
    'admin.project_services.back': 'Back to Project 360',
    'admin.project_services.base_price': 'Base price',
    'admin.project_services.price_override': 'Project price (THB)',
    'admin.project_services.lead_time': 'Project lead time (hours)',
    'admin.project_services.take_rate': 'Project take rate (%)',
    'admin.project_services.save_terms': 'Save preference',
    'admin.project_services.clear': 'Use global defaults',
    'admin.project_services.saved': 'Concierge preference saved.',
    'admin.project_services.inherit': 'global default',
    'admin.project_services.error': 'Could not update concierge preference.',
  });

  const rows = services.map(service => {
    const here = service.availableProjects.find(row => row.project_id === project.id);
    return {
      id: service.id,
      title: service.title,
      providerName: service.provider.name,
      categoryKey: service.categoryKey,
       basePriceThb: service.basePriceThb,
      baseLeadTimeHours: service.advanceNoticeHours,
      priceOverrideThb: here?.price_override_thb ?? null,
      leadTimeHours: here?.lead_time_hours ?? null,
      takeRatePct: here?.take_rate_pct?.toString() ?? null,
      termsVersion: here?.terms_version ?? null,
    };
  });

  return <main className="mx-auto max-w-5xl p-24 md:p-32">
    <ProjectWorkspaceNav projectId={project.id} active="concierge" />
    <Link href={`/app/admin/projects/${project.id}`} className="text-small font-semibold text-brand-andaman hover:underline">
      ← {labels['admin.project_services.back']}
    </Link>
    <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['admin.project_services.title']} · {project.name}</h1>
    <p className="mt-8 mb-24 max-w-3xl text-body text-text-secondary">{labels['admin.project_services.body']}</p>
    <ProjectServicesClient projectId={project.id} services={rows} labels={labels} />
  </main>;
}
