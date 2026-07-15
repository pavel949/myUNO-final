import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import Tm30QueueClient from './tm30-client';

export const dynamic = 'force-dynamic';

export default async function Tm30QueuePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/tm30');
  }
  const isStaff = user.roles.some((role) => role.role === 'staff_ops');
  if (!isStaff && !user.isAdmin) {
    redirect('/');
  }

  // SLA-sorted queue across all projects (doc 07 F-OPS-2)
  const filings = await prisma.tm30Filing.findMany({
    where: { status: { in: ['pending', 'escalated', 'failed'] } },
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
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link href="/ops" className="text-brand-andaman font-semibold hover:underline">
            {labels['staff.tm30.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['staff.tm30.title']}
        </h1>
        <Tm30QueueClient
          filings={filings.map((f) => ({
            id: f.id,
            status: f.status,
            dueAt: f.dueAt.toISOString(),
            guestName: f.bookingGuest?.fullName || '—',
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
