import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getMcBookingRequests } from '@/modules/projects';
import { getBookingDeclineReasonOptions } from '@/modules/booking';
import { getMCProjectScopes } from '@/app/libs/projectScope';
import McRequestsClient from './requests-client';

export const dynamic = 'force-dynamic';

interface McRequestsPageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
  };
}

/**
 * Booking request inbox for MC-managed units (doc 07 F-OPS-5 / F-MC-2).
 */
export default async function McRequestsPage({ searchParams }: McRequestsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc/requests');
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
    href: `/mc/requests?projectId=${encodeURIComponent(scope.projectId)}&organizationId=${encodeURIComponent(
      scope.organizationId
    )}`,
    label: `${projectNameById.get(scope.projectId) || scope.projectId} · ${
      organizationNameById.get(scope.organizationId) || scope.organizationId
    }`,
  }));

  const requests = await getMcBookingRequests(
    prisma,
    user.identityId,
    activeScope.projectId,
    activeScope.organizationId
  );
  const declineReasons = await getBookingDeclineReasonOptions(getRequestLocale());

  const backHref = `/mc?projectId=${encodeURIComponent(activeScope.projectId)}&organizationId=${encodeURIComponent(
    activeScope.organizationId
  )}`;

  const labels = await getLabels({
    'mc.requests.title': 'Booking requests',
    'mc.requests.back': '← MC portal',
    'mc.requests.context': 'Portfolio context',
    'mc.requests.empty': 'No pending booking requests.',
    'mc.requests.guests': 'guests',
    'mc.requests.expires': 'Respond by',
    'mc.requests.approve': 'Approve',
    'mc.requests.decline': 'Decline',
    'mc.requests.decline_reason': 'Decline reason',
    'mc.requests.decline_reason_required': 'Select a decline reason.',
    'mc.requests.confirm_decline': 'Decline this booking request? The guest will be notified.',
    'mc.requests.error_generic': 'Action failed. Please try again.',
  });

  const activeContextKey = `${activeScope.projectId}:${activeScope.organizationId}`;

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link href={backHref} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.requests.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12 mb-24">
          {labels['mc.requests.title']}
        </h1>

        {contexts.length > 1 && (
          <div className="mb-24">
            <p className="text-small text-text-secondary mb-8">{labels['mc.requests.context']}</p>
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

        <McRequestsClient
          declineReasons={declineReasons}
          requests={requests.map((request) => ({
            id: request.id,
            startDate: request.startDate.toISOString(),
            endDate: request.endDate.toISOString(),
            totalThb: Math.round(request.totalThb / 100),
            requestExpiresAt: request.requestExpiresAt
              ? request.requestExpiresAt.toISOString()
              : null,
            adults: request.adults,
            children: request.children,
            guestName: `${request.guestIdentity.firstName} ${request.guestIdentity.lastName}`,
            unitId: request.unit.id,
            unitName: request.unit.name,
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
