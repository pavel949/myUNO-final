import React from 'react';
import { fetchMCDashboard } from '@/app/actions/getMCDashboard';
import { MCDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function MCPortalPage() {
  // TODO: Get from auth session + MC member role scope
  const mcIdentityId = 'mc-member-1';
  const projectId = 'project-1';
  const organizationId = 'org-1';

  const data = await fetchMCDashboard(mcIdentityId, projectId, organizationId);

  return <MCDashboardClient {...data} />;
}
