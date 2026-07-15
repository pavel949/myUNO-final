import React from 'react';
import { redirect } from 'next/navigation';
import { fetchInStayHomeSpace } from '@/app/actions/getInStayHomeSpace';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { InStayHomeSpaceClient } from './client';

export const dynamic = 'force-dynamic';

interface InStayHomeSpacePageProps {
  params: {
    bookingId: string;
  };
}

export default async function InStayHomeSpacePage({ params }: InStayHomeSpacePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/bookings/${params.bookingId}/home-space`);
  }

  const data = await fetchInStayHomeSpace(params.bookingId, user.identityId);

  return <InStayHomeSpaceClient {...data} />;
}
