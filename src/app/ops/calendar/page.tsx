import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';

export const dynamic = 'force-dynamic';

interface OpsCalendarIndexPageProps {
  searchParams?: {
    projectId?: string;
  };
}

/**
 * Unit picker for ops calendar / pricing upkeep (doc 07 F-OPS-4).
 */
export default async function OpsCalendarIndexPage({ searchParams }: OpsCalendarIndexPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/calendar');
  }

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  const isStaff = opsContext.isAdmin || opsContext.staffProjectIds.length > 0;
  if (!isStaff) {
    redirect('/');
  }

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );

  const scope = opsBoardScope(opsContext, validActiveProjectId);
  const units = await prisma.unit.findMany({
    where: {
      status: { not: 'offboarded' },
      ...(scope?.projectIds?.length ? { projectId: { in: scope.projectIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
  });

  const labels = await getLabels({
    'staff.ops.calendar_index.title': 'Unit calendars',
    'staff.ops.calendar_index.back': '← Ops board',
    'staff.ops.calendar_index.hint': 'Pick a unit to block dates or set one-off rates.',
    'staff.ops.calendar_index.empty': 'No units in this project scope.',
    'staff.ops.calendar_index.open': 'Open calendar →',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link
          href={opsHref('/ops', validActiveProjectId)}
          className="text-small font-semibold text-brand-andaman hover:underline"
        >
          {labels['staff.ops.calendar_index.back']}
        </Link>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mt-12 mb-8">
          {labels['staff.ops.calendar_index.title']}
        </h1>
        <p className="text-body text-text-stone mb-24">
          {labels['staff.ops.calendar_index.hint']}
        </p>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath="/ops/calendar"
          labels={labels}
        />

        {units.length === 0 ? (
          <p className="text-body text-text-secondary mt-24">
            {labels['staff.ops.calendar_index.empty']}
          </p>
        ) : (
          <ul className="space-y-12 mt-24">
            {units.map((unit) => (
              <li
                key={unit.id}
                className="bg-surface-paper border border-border-line rounded-lg shadow-card p-20 flex items-center justify-between gap-16"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                  <p className="text-small text-text-secondary mt-4">{unit.project.name}</p>
                </div>
                <Link
                  href={opsHref(`/ops/calendar/${unit.id}`, validActiveProjectId ?? unit.project.id)}
                  className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                >
                  {labels['staff.ops.calendar_index.open']}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
