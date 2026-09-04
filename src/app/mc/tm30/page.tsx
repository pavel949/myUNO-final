import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getMcTm30Queue } from '@/modules/projects';
import { safeDecrypt } from '@/modules/ops';
import { getMCProjectScopes } from '@/app/libs/projectScope';
import Tm30QueueClient from '@/app/ops/tm30/tm30-client';

export const dynamic = 'force-dynamic';

interface McTm30PageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
  };
}

/**
 * TM30 queue for MC-managed units (doc 03, F-MC-2).
 */
export default async function McTm30Page({ searchParams }: McTm30PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc/tm30');
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
    href: `/mc/tm30?projectId=${encodeURIComponent(scope.projectId)}&organizationId=${encodeURIComponent(
      scope.organizationId
    )}`,
    label: `${projectNameById.get(scope.projectId) || scope.projectId} · ${
      organizationNameById.get(scope.organizationId) || scope.organizationId
    }`,
  }));

  const filings = await getMcTm30Queue(
    prisma,
    user.identityId,
    activeScope.projectId,
    activeScope.organizationId
  );

  const backHref = `/mc?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
    activeScope.organizationId
  )}`;

  const labels = await getLabels({
    'mc.tm30.title': 'TM30 queue',
    'mc.tm30.back': '← MC portal',
    'mc.tm30.context': 'Portfolio context',
    'staff.tm30.empty': 'No filings due. Everything is filed.',
    'staff.tm30.due': 'Due',
    'staff.tm30.overdue': 'OVERDUE',
    'staff.tm30.status.pending': 'Pending',
    'staff.tm30.status.escalated': 'Escalated',
    'staff.tm30.status.failed': 'Failed',
    'staff.tm30.file_action': 'Mark filed',
    'staff.tm30.file_confirm': 'Confirm the TM30 for {guest} has been filed with immigration?',
    'staff.tm30.error_generic': 'Action failed. Please try again.',
  });

  const activeContextKey = `${activeScope.projectId}:${activeScope.organizationId}`;

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link href={backHref} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.tm30.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12 mb-24">
          {labels['mc.tm30.title']}
        </h1>

        {contexts.length > 1 && (
          <div className="mb-24">
            <p className="text-small text-text-secondary mb-8">{labels['mc.tm30.context']}</p>
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

        <Tm30QueueClient
          filings={filings.map((filing) => ({
            id: filing.id,
            status: filing.status,
            dueAt: filing.dueAt.toISOString(),
            guestName: safeDecrypt(filing.guestNameEncrypted) || filing.guestNationality || '—',
            nationality: filing.guestNationality || '—',
            unitName: filing.unitName,
            projectName: filing.projectName,
            arrival: filing.arrival.toISOString(),
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
