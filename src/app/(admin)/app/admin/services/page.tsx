import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { redirect } from 'next/navigation';
import ServicesAdminClient from './services-client';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) redirect('/');

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    redirect('/');
  }

  const services = await prisma.service.findMany({
    where: { status: 'draft' },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  const labels = await getLabels({
    'admin.services.title': 'Service Submissions',
    'admin.services.empty': 'No pending submissions.',
    'admin.services.approve': 'Approve',
    'admin.services.reject': 'Reject',
    'admin.services.status_draft': 'Draft',
    'admin.services.status_vetted': 'Approved',
    'admin.services.status_rejected': 'Rejected',
    'admin.services.reason_placeholder': 'Rejection reason',
    'admin.services.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.services.title']}
      </h1>
      <ServicesAdminClient
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          providerName: s.provider?.name || '—',
          status: s.status,
          createdAt: s.createdAt.toISOString(),
        }))}
        labels={labels}
      />
    </div>
  );
}
