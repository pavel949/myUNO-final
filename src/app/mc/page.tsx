import React from 'react';
import { redirect } from 'next/navigation';
import { fetchMCDashboard } from '@/app/actions/getMCDashboard';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { MCDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function MCPortalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/mc');
  }

  const mcRole = user.roles.find(
    (role) => role.role === 'mc_member' && role.projectId && role.organizationId
  );
  if (!mcRole) {
    redirect('/');
  }

  const data = await fetchMCDashboard(
    user.identityId,
    mcRole.projectId as string,
    mcRole.organizationId as string
  );

  return <MCDashboardClient {...data} />;
}
