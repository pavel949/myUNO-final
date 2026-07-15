'use client';

import React from 'react';

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  guestIdentity: {
    id: string;
    firstName: string;
  };
  guests: Array<{
    nationality: string;
  }>;
}

interface BookingsListProps {
  bookings: Booking[];
  loading?: boolean;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (thb: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
};

export const BookingsList = React.forwardRef<HTMLDivElement, BookingsListProps>(
  ({ bookings, loading }, ref) => {
    if (loading) {
      return (
        <div ref={ref} className="space-y-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-surface-paper rounded-md animate-pulse" />
          ))}
        </div>
      );
    }

    if (!bookings || bookings.length === 0) {
      return (
        <div ref={ref} className="text-center py-48">
          <p className="text-body text-text-secondary">No bookings yet</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-12">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="border border-border-line rounded-md p-20 hover:bg-surface-paper-soft transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-body font-medium text-text-ink">{booking.guestIdentity.firstName}</p>
                <p className="text-small text-text-secondary mt-4">
                  {booking.guests[0]?.nationality || 'Unknown'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-body font-medium text-text-ink">
                  {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                </p>
                <p className="text-small text-text-secondary mt-4">{formatCurrency(booking.totalThb)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

BookingsList.displayName = 'BookingsList';
