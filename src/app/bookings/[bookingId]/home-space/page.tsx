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
    'home.stay.check_in': 'Check-in',
    'home.stay.check_out': 'Check-out',
    'home.stay.checked_in_note': 'You are checked in. Everything you need is on this page.',
    'home.stay.visiting_from': 'Visiting from {nationality}',
    'home.stay_status.confirmed': 'Confirmed',
    'home.stay_status.checked_in': 'Checked in',
    'home.stay_status.checked_out': 'Checked out',
    'home.action.message_host': 'Message host',
    'home.action.order_service': 'Order a service',
    'home.action.raise_issue': 'Raise an issue',
    'home.action.extend_stay': 'Extend stay',
    'home.services.title': 'Services for your stay',
    'home.services.vetted': 'Vetted',
    'home.services.from': 'from',
    'home.extend.title': 'Stay longer',
    'home.extend.description':
      'Choose a new check-out date. We will check the calendar and price the extra nights before anything is charged.',
    'home.extend.new_end_date': 'New check-out date',
    'home.extend.submit': 'Check availability',
    'home.extend.note': 'The extra nights are added to your stay balance and paid separately.',
    'home.extend.error_generic':
      'We could not extend the stay. Please try again or message the host.',
    'home.role_context': 'You are also the {role} of {unit}. This page shows your stay.',
    'home.role_context.owner_link': 'Go to owner dashboard',
    'home.role.owner': 'owner',
    'home.role.resident': 'resident',
    'home.role.buyer': 'buyer',
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
