import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { getProviderApplications } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { redirect } from 'next/navigation';
import ProvidersAdminClient from './providers-client';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
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

  const providers = await getProviderApplications(prisma, {
    status: 'applied',
    limit: 50,
    offset: 0,
  });

  const labels = await getLabels({
    'admin.providers.title': 'Provider Applications',
    'admin.providers.empty': 'No pending applications.',
    'admin.providers.approve': 'Approve',
    'admin.providers.reject': 'Reject',
    'admin.providers.status_applied': 'Applied',
    'admin.providers.status_approved': 'Approved',
    'admin.providers.status_rejected': 'Rejected',
    'admin.providers.reason_placeholder': 'Rejection reason',
    'admin.providers.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.providers.title']}
      </h1>
      <ProvidersAdminClient
        providers={providers.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }))}
        labels={labels}
      />
    </div>
  );
}
