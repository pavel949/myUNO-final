import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getMcMobilizationQueue } from '@/modules/projects';
import { getMCProjectScopes } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

interface McMobilizationPageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
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
 * Mobilization queue for MC-managed units (doc 07 F-OWN-1 via MC path).
 */
export default async function McMobilizationPage({ searchParams }: McMobilizationPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc/mobilization');
  }

  const mcScopes = getMCProjectScopes(user);
  if (mcScopes.length === 0) {
    redirect('/');
  }

  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null;
  const requestedOrganizationId =
    typeof searchParams?.organizationId === 'string' ? searchParams.organizationId : null;

  const activeScope =
    mcScopes.find(
      (scope) =>
        scope.projectId === requestedProjectId &&
        (!requestedOrganizationId || scope.organizationId === requestedOrganizationId)
    ) ||
    (requestedProjectId ? mcScopes.find((scope) => scope.projectId === requestedProjectId) : null) ||
    mcScopes[0];

  const projectIds = Array.from(new Set(mcScopes.map((scope) => scope.projectId)));
  const organizationIds = Array.from(new Set(mcScopes.map((scope) => scope.organizationId)));
  const [projects, organizations] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    }),
    prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
    }),
  ]);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const organizationNameById = new Map(
    organizations.map((organization) => [organization.id, organization.name])
  );

  const contexts = mcScopes.map((scope) => ({
    key: `${scope.projectId}:${scope.organizationId}`,
    href: `/mc/mobilization?projectId=${encodeURIComponent(scope.projectId)}&organizationId=${encodeURIComponent(
      scope.organizationId
    )}`,
    label: `${projectNameById.get(scope.projectId) || scope.projectId} · ${
      organizationNameById.get(scope.organizationId) || scope.organizationId
    }`,
  }));

  const units = await getMcMobilizationQueue(
    prisma,
    user.identityId,
    activeScope.projectId,
    activeScope.organizationId
  );

  const backHref = `/mc?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
    activeScope.organizationId
  )}`;

  const labels = await getLabels({
    'mc.mobilization.title': 'Mobilization',
    'mc.mobilization.back': '← MC portal',
    'mc.mobilization.context': 'Portfolio context',
    'mc.mobilization.empty': 'No units are currently in mobilization.',
    'mc.mobilization.progress': '{completed} of {total} steps done',
    'mc.mobilization.next': 'Next step',
    'mc.mobilization.open': 'Open checklist →',
  });

  const activeContextKey = `${activeScope.projectId}:${activeScope.organizationId}`;
  const unitHref = (unitId: string) =>
    `/mc/mobilization/${unitId}?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
      activeScope.organizationId
    )}`;

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link href={backHref} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.mobilization.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12 mb-24">
          {labels['mc.mobilization.title']}
        </h1>

        {contexts.length > 1 && (
          <div className="mb-24">
            <p className="text-small text-text-secondary mb-8">{labels['mc.mobilization.context']}</p>
            <div className="flex flex-wrap gap-8">
              {contexts.map((context) => (
                <Link
                  key={context.key}
                  href={context.href}
                  className={`inline-flex items-center rounded-full px-12 py-6 text-small border transition-colors ${
                    context.key === activeContextKey
                      ? 'bg-brand-andaman-soft text-brand-andaman border-brand-andaman'
                      : 'bg-surface-paper text-text-secondary border-border-line hover:text-text-ink'
                  }`}
                >
                  {context.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {units.length === 0 ? (
          <p className="text-body text-text-secondary">{labels['mc.mobilization.empty']}</p>
        ) : (
          <ul className="space-y-12">
            {units.map((unit) => (
              <li
                key={unit.id}
                className="bg-surface-paper border border-border-line rounded-lg p-20 flex items-center justify-between gap-16"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                  <p className="text-small text-text-secondary mt-4">
                    {unit.projectName} ·{' '}
                    {fill(labels['mc.mobilization.progress'], {
                      completed: unit.completedSteps,
                      total: unit.totalSteps,
                    })}
                    {unit.nextStep
                      ? ` · ${labels['mc.mobilization.next']}: ${unit.nextStep}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={unitHref(unit.id)}
                  className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                >
                  {labels['mc.mobilization.open']}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
