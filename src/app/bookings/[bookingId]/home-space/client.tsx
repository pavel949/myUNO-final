'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import {
  StayCard,
  QuickActionsRow,
  ActiveOrdersList,
  AnnouncementsSection,
} from '@/components';

interface Unit {
  id: string;
  name: string;
  projectId: string;
  project: {
    id: string;
    name: string;
  };
}

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  checkedInAt: string | null;
  unit: Unit;
  guest: {
    id: string;
    nationality: string;
  } | null;
}

interface ActiveOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  totalThb: number;
  scheduledStart: string;
  scheduledEnd: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface InStayHomeSpaceClientProps {
  booking: Booking;
  activeOrders: ActiveOrder[];
  announcements: Announcement[];
}

export const InStayHomeSpaceClient: React.FC<InStayHomeSpaceClientProps> = ({
  booking,
  activeOrders,
  announcements,
}) => {
  const router = useRouter();
  const handleMessageHost = async () => {
    // F-COM-1: booking-context thread with ops + owner
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextType: 'booking',
        contextId: booking.id,
        body: `[${booking.unit.name}]`,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      router.push(`/messages/${data.threadId}`);
    }
  };

  const handleOrderService = () => {
    // F-SVC-2: services marketplace scoped to this stay
    router.push(`/services?bookingId=${booking.id}`);
  };

  const handleRaiseIssue = () => {
    // F-COM-3: raise-ticket form pre-scoped to this stay
    router.push(
      `/tickets/new?projectId=${booking.unit.project.id}&unitId=${booking.unit.id}&bookingId=${booking.id}`
    );
  };

  const handleExtendStay = () => {
    // F-GUEST-9: date change lives on the trip page
    router.push(`/trips/${booking.id}`);
  };

  return (
    <div className="min-h-screen bg-surface-background">
      {/* Header with project branding */}
      <div className="bg-brand-andaman text-surface-ivory py-16 px-24 mb-32">
        <p className="text-small">Welcome to</p>
        <h1 className="text-heading-1 font-bold">{booking.unit.project.name}</h1>
      </div>

      <div className="max-w-4xl mx-auto px-24">
        {/* Hero stay card */}
        <StayCard
          projectName={booking.unit.project.name}
          unitName={booking.unit.name}
          startDate={booking.startDate}
          endDate={booking.endDate}
          status={booking.status}
          checkedInAt={booking.checkedInAt}
          guestNationality={booking.guest?.nationality}
        />

        {/* Quick actions row */}
        <QuickActionsRow
          onMessageHost={handleMessageHost}
          onOrderService={handleOrderService}
          onRaiseIssue={handleRaiseIssue}
          onExtendStay={handleExtendStay}
        />

        {/* Announcements section */}
        <AnnouncementsSection announcements={announcements} />

        {/* Active orders section */}
        {activeOrders.length > 0 && (
          <div className="mb-40">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">Your Active Orders</h2>
            <ActiveOrdersList orders={activeOrders} />
          </div>
        )}

        {/* Handbook and resources section */}
        <div className="bg-surface-paper border border-border-line rounded-md p-32 mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">📚 Property Handbook</h2>
          <p className="text-body text-text-secondary mb-20">
            Learn about the property amenities, check-out procedures, and local information.
          </p>
          <button className="text-brand-andaman font-medium hover:underline">
            View Handbook →
          </button>
        </div>

        {/* Footer message */}
        <div className="text-center py-32 mb-40">
          <p className="text-body text-text-secondary">
            Need help? Contact the host or raise an issue above.
          </p>
        </div>
      </div>

      {/* TODO: Add modals for message, service order, issue, and extend stay */}
      {/* These will be implemented once the respective modal components are available */}
    </div>
  );
};
