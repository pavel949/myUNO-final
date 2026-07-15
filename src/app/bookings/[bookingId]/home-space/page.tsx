import React from 'react';
import { fetchInStayHomeSpace } from '@/app/actions/getInStayHomeSpace';
import { InStayHomeSpaceClient } from './client';

export const dynamic = 'force-dynamic';

interface InStayHomeSpacePageProps {
  params: {
    bookingId: string;
  };
}

export default async function InStayHomeSpacePage({ params }: InStayHomeSpacePageProps) {
  const guestIdentityId = 'guest-1'; // TODO: Get from auth session

  const data = await fetchInStayHomeSpace(params.bookingId, guestIdentityId);

  return <InStayHomeSpaceClient {...data} />;
}
