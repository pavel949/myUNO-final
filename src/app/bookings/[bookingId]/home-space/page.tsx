import React from 'react';
import { redirect } from 'next/navigation';
import { fetchInStayHomeSpace } from '@/app/actions/getInStayHomeSpace';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { t } from '@/modules/content';
import { prisma } from '@/lib/prisma';
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
  const labels = await getLabels({
    'home.welcome': 'Welcome to',
    'home.handbook.title': 'Property Handbook',
    'home.handbook.description': 'Learn about the property amenities, check-out procedures, and local information.',
    'home.handbook.view_button': 'View Handbook',
    'home.help_text': 'Need help? Contact the host or raise an issue above.',
    'home.active_orders': 'Your Active Orders',
    'home.concierge_whatsapp': 'Message the concierge on WhatsApp',
    'home.shuttle.title': 'Beach shuttle schedule',
  });

  // Project-specific shuttle schedule (content key; empty until the founder
  // supplies the real timetable — Q29)
  const shuttleKey = `project.${data.booking.unit.project.slug}.shuttle_schedule`;
  let shuttleText = '';
  try {
    const value = await t(prisma, shuttleKey, undefined, getRequestLocale());
    shuttleText = value && value !== shuttleKey && value !== '—' ? value : '';
  } catch {
    shuttleText = '';
  }

  return <InStayHomeSpaceClient {...data} shuttleText={shuttleText} labels={labels} />;
}
