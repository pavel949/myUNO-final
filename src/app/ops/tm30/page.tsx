import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { safeDecrypt } from '@/modules/ops';
import Tm30QueueClient from './tm30-client';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';
import {
  loadOpsSwitcherProjects,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';

export const dynamic = 'force-dynamic';

interface Tm30QueuePageProps {
  searchParams?: {
    projectId?: string;
  };
}

export default async function Tm30QueuePage({ searchParams }: Tm30QueuePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/tm30');
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

  const projectFilter =
    opsContext.isAdmin && !validActiveProjectId
      ? {}
      : {
          booking: {
            projectId: {
              in: validActiveProjectId
                ? [validActiveProjectId]
                : opsContext.queryProjectIds || [],
            },
          },
        };

  const filings = await prisma.tm30Filing.findMany({
    where: {
      status: { in: ['pending', 'escalated', 'failed'] },
      ...projectFilter,
    },
    include: {
      booking: {
        select: {
          id: true,
          startDate: true,
          unit: { select: { name: true } },
          project: { select: { name: true } },
        },
      },
      bookingGuest: { select: { fullName: true, nationality: true } },
    },
    orderBy: { dueAt: 'asc' },
  });

  const labels = await getLabels({
    'staff.tm30.title': 'TM30 queue',
    'staff.tm30.back': '← Ops board',
    'staff.tm30.empty': 'No filings due. Everything is filed.',
    'staff.tm30.due': 'Due',
    'staff.tm30.overdue': 'OVERDUE',
    'staff.tm30.status.pending': 'Pending',
    'staff.tm30.status.escalated': 'Escalated',
    'staff.tm30.status.failed': 'Failed',
    'staff.tm30.file_action': 'Mark filed',
    'staff.tm30.file_confirm': 'Confirm the TM30 for {guest} has been filed with immigration?',
    'staff.tm30.error_generic': 'Action failed. Please try again.',
    'staff.tm30.detail_action': 'Open filing',
    'staff.tm30.detail_title': 'TM30 filing — {guest}',
    'staff.tm30.detail_close': 'Close',
    'staff.tm30.detail_loading': 'Loading passport details…',
    'staff.tm30.passport_section': 'Passport details',
    'staff.tm30.passport_name': 'Full name',
    'staff.tm30.passport_nationality': 'Nationality',
    'staff.tm30.passport_number': 'Passport number',
    'staff.tm30.passport_dob': 'Date of birth',
    'staff.tm30.passport_missing': 'Not captured yet',
    'staff.tm30.passport_access_logged': 'Access to this data is logged for compliance.',
    'staff.tm30.address_section': 'Address for immigration portal',
    'staff.tm30.address_copy': 'Copy address',
    'staff.tm30.address_copied': 'Copied',
    'staff.tm30.portal_link': 'Open immigration portal →',
    'staff.tm30.file_section': 'Mark as filed',
    'staff.tm30.receipt_hint': 'Optional: upload the immigration receipt screenshot after filing.',
    'staff.tm30.receipt_upload_error': 'Could not upload receipt image.',
    'staff.tm30.fail_section': 'Portal rejected or unavailable',
    'staff.tm30.fail_hint': 'Record what happened. The filing will be escalated to admin.',
    'staff.tm30.fail_note_placeholder': 'e.g. Portal down, passport rejected',
    'staff.tm30.fail_note_required': 'Enter a note explaining the failure.',
    'staff.tm30.fail_confirm': 'Mark this filing as failed and escalate?',
    'staff.tm30.fail_action': 'Mark failed',
    'staff.tm30.copy_error': 'Could not copy to clipboard.',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const switcherBasePath = '/ops/tm30';

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link
            href={opsHref('/ops', validActiveProjectId)}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels['staff.tm30.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['staff.tm30.title']}
        </h1>
        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath={switcherBasePath}
          labels={labels}
        />
        <Tm30QueueClient
          filings={filings.map((f) => ({
            id: f.id,
            status: f.status,
            dueAt: f.dueAt.toISOString(),
            guestName: safeDecrypt(f.bookingGuest?.fullName) || '—',
            nationality: f.bookingGuest?.nationality || '—',
            unitName: f.booking?.unit?.name || '—',
            projectName: f.booking?.project?.name || '—',
            arrival: f.booking?.startDate.toISOString() || null,
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
