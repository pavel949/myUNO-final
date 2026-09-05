import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getMCManagedUnits } from '@/modules/projects';
import { getMCProjectScopes } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

interface McCalendarIndexPageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
  };
}

/**
 * Unit picker for MC availability & pricing upkeep (doc 07 F-MC-2, F-OPS-4).
 */
export default async function McCalendarIndexPage({ searchParams }: McCalendarIndexPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc/calendar');
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
    href: `/mc/calendar?projectId=${encodeURIComponent(scope.projectId)}&organizationId=${encodeURIComponent(
      scope.organizationId
    )}`,
    label: `${projectNameById.get(scope.projectId) || scope.projectId} · ${
      organizationNameById.get(scope.organizationId) || scope.organizationId
    }`,
  }));

  const unitsRaw = await getMCManagedUnits(
    prisma,
    user.identityId,
    activeScope.projectId,
    activeScope.organizationId
  );
  const units = unitsRaw
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      projectName: projectNameById.get(activeScope.projectId) || activeScope.projectId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const backHref = `/mc?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
    activeScope.organizationId
  )}`;
  const activeContextKey = `${activeScope.projectId}:${activeScope.organizationId}`;

  const labels = await getLabels({
    'mc.calendar_index.title': 'Unit calendars',
    'mc.calendar_index.back': '← MC portal',
    'mc.calendar_index.hint': 'Pick a unit to block dates or set one-off rates.',
    'mc.calendar_index.empty': 'No managed units in this portfolio context.',
    'mc.calendar_index.open': 'Open calendar →',
    'mc.calendar_index.context': 'Portfolio context',
  });

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link href={backHref} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.calendar_index.back']}
        </Link>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mt-12 mb-8">
          {labels['mc.calendar_index.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">{labels['mc.calendar_index.hint']}</p>

        {contexts.length > 1 && (
          <div className="mb-24">
            <p className="text-small text-text-secondary mb-8">{labels['mc.calendar_index.context']}</p>
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
          <p className="text-body text-text-secondary">{labels['mc.calendar_index.empty']}</p>
        ) : (
          <ul className="space-y-12">
            {units.map((unit) => (
              <li
                key={unit.id}
                className="bg-surface-paper border border-border-line rounded-lg p-20 flex items-center justify-between gap-16"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                  <p className="text-small text-text-secondary mt-4">{unit.projectName}</p>
                </div>
                <Link
                  href={`/mc/units/${unit.id}`}
                  className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                >
                  {labels['mc.calendar_index.open']}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
