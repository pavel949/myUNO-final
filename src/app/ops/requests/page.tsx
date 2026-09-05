import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getOpsBookingRequests } from '@/modules/ops';
import { getBookingDeclineReasonOptions } from '@/modules/booking';
import OpsRequestsClient from './requests-client';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import { bookingRequestInboxLabelDrafts } from '@/lib/bookingRequestInboxLabels';

export const dynamic = 'force-dynamic';

interface OpsRequestsPageProps {
  searchParams?: {
    projectId?: string;
  };
}

/**
 * Staff booking request inbox (doc 07 F-OPS-5).
 */
export default async function OpsRequestsPage({ searchParams }: OpsRequestsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/requests');
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
  const [requests, declineReasons] = await Promise.all([
    getOpsBookingRequests(prisma, scope),
    getBookingDeclineReasonOptions(getRequestLocale()),
  ]);

  const labels = await getLabels({
    ...bookingRequestInboxLabelDrafts,
    'staff.ops.requests_title': 'Booking requests',
    'staff.ops.requests_back': '← Ops board',
    'staff.ops.requests_empty': 'No pending booking requests.',
    'staff.ops.approve_request': 'Approve',
    'staff.ops.decline_request': 'Decline',
    'staff.ops.decline_reason': 'Decline reason',
    'staff.ops.decline_reason_required': 'Select a decline reason.',
    'staff.ops.confirm_decline_request':
      'Decline this booking request? The guest will be notified.',
    'staff.ops.request_expires': 'Respond by',
    'staff.ops.guest': 'Guest',
    'staff.ops.error_generic': 'Action failed. Please try again.',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const switcherBasePath = '/ops/requests';
  const showProjectName = !validActiveProjectId;

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link
            href={opsHref('/ops', validActiveProjectId)}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels['staff.ops.requests_back']}
          </Link>
        </p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
          {labels['staff.ops.requests_title']}
        </h1>
        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath={switcherBasePath}
          labels={labels}
        />
        <OpsRequestsClient
          showProjectName={showProjectName}
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
            projectName: request.projectName,
            unitId: request.unit.id,
            unitName: request.unit.name,
            unitCalendarHref: opsHref(`/ops/calendar/${request.unit.id}`, validActiveProjectId),
            nights: request.nights,
            completedStayCount: request.completedStayCount,
            breakdownLines: request.breakdownLines,
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
