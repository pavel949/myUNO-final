import React from 'react';
import { fetchOwnerDashboard } from '@/app/actions/getOwnerDashboard';
import { OwnerDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const ownerIdentityId = 'owner-1'; // TODO: Get from auth session

  const data = await fetchOwnerDashboard(ownerIdentityId);

  return <OwnerDashboardClient {...data} />;
}
