import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getOpsMobilizationQueue } from '@/modules/ops';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';

export const dynamic = 'force-dynamic';

interface OpsMobilizationPageProps {
  searchParams?: {
    projectId?: string;
  };
}

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Mobilization queue for staff (doc 07 F-OWN-1 ops path).
 */
export default async function OpsMobilizationPage({ searchParams }: OpsMobilizationPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/mobilization');
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

  const units = await getOpsMobilizationQueue(
    prisma,
    opsBoardScope(opsContext, validActiveProjectId)
  );

  const labels = await getLabels({
    'staff.ops.mobilization_title': 'Mobilization',
    'staff.ops.mobilization_back': '← Ops board',
    'staff.ops.mobilization_empty': 'No units are currently in mobilization.',
    'staff.ops.mobilization_progress': '{completed} of {total} steps done',
    'staff.ops.mobilization_next': 'Next step',
    'staff.ops.mobilization_open': 'Open checklist →',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const unitHref = (unitId: string, projectId: string) =>
    opsHref(`/ops/mobilization/${unitId}`, validActiveProjectId ?? projectId);

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link
          href={opsHref('/ops', validActiveProjectId)}
          className="text-small font-semibold text-brand-andaman hover:underline"
        >
          {labels['staff.ops.mobilization_back']}
        </Link>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mt-12 mb-24">
          {labels['staff.ops.mobilization_title']}
        </h1>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath="/ops/mobilization"
          labels={labels}
        />

        {units.length === 0 ? (
          <p className="text-body text-text-secondary mt-24">
            {labels['staff.ops.mobilization_empty']}
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
                  <p className="text-small text-text-secondary mt-4">
                    {unit.projectName} ·{' '}
                    {fill(labels['staff.ops.mobilization_progress'], {
                      completed: unit.completedSteps,
                      total: unit.totalSteps,
                    })}
                    {unit.nextStep
                      ? ` · ${labels['staff.ops.mobilization_next']}: ${unit.nextStep}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={unitHref(unit.id, unit.projectId)}
                  className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                >
                  {labels['staff.ops.mobilization_open']}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
