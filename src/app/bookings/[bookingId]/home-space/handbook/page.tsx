import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getLabels } from '@/lib/i18n';
import { fetchHandbookContent } from '@/app/actions/getHandbookContent';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

interface HandbookPageProps {
  params: {
    bookingId: string;
  };
}

export default async function HandbookPage({ params }: HandbookPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/bookings/${params.bookingId}/home-space/handbook`);
  }

  const { projectName, handbookContent } = await fetchHandbookContent(params.bookingId);

  const labels = await getLabels({
    'booking.handbook.breadcrumb_home': 'Home',
    'booking.handbook.breadcrumb_trips': 'My Trips',
    'booking.handbook.breadcrumb_handbook': 'Property Handbook',
    'booking.handbook.back_link': '← Back',
    'booking.handbook.title': 'Property Handbook',
    'booking.handbook.empty_state': 'No handbook content available. Please contact the property management.',
  });

  const breadcrumbs = [
    { label: labels['booking.handbook.breadcrumb_home'], href: '/' },
    { label: labels['booking.handbook.breadcrumb_trips'], href: '/trips' },
    { label: projectName, href: `/bookings/${params.bookingId}` },
    { label: labels['booking.handbook.breadcrumb_handbook'], current: true },
  ];

  return (
    <div className="min-h-screen bg-surface-background">
      <Breadcrumb items={breadcrumbs} />

      {/* Header */}
      <div className="bg-brand-andaman text-surface-ivory py-24 px-24 mb-32">
        <div className="max-w-4xl mx-auto">
          <Link href={`/bookings/${params.bookingId}/home-space`}>
            <Button variant="secondary" size="sm">
              {labels['booking.handbook.back_link']}
            </Button>
          </Link>
          <h1 className="text-heading-1 font-bold text-surface-ivory mt-16">{labels['booking.handbook.title']}</h1>
          <p className="text-body text-surface-ivory mt-8">{projectName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-24 py-32">
        <div className="prose prose-invert max-w-none">
          {handbookContent ? (
            <div className="text-body text-text-ink whitespace-pre-wrap">
              {handbookContent}
            </div>
          ) : (
            <div className="bg-surface-paper border border-border-line rounded-md p-24">
              <p className="text-body text-text-secondary text-center">
                {labels['booking.handbook.empty_state']}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
