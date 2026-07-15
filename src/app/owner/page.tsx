import React from 'react';
import { redirect } from 'next/navigation';
import { fetchOwnerDashboard } from '@/app/actions/getOwnerDashboard';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { OwnerDashboardClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/owner');
  }

  const data = await fetchOwnerDashboard(user.identityId);

  return <OwnerDashboardClient {...data} />;
}
