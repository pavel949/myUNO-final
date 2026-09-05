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
  labels: {
    empty: string;
    unknownNationality: string;
  };
  locale: string;
  loading?: boolean;
}

const formatDate = (dateStr: string, locale: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const formatCurrency = (thb: number, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
};

export const BookingsList = React.forwardRef<HTMLDivElement, BookingsListProps>(
  ({ bookings, labels, locale, loading }, ref) => {
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
          <p className="text-body text-text-secondary">{labels.empty}</p>
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
                  {booking.guests[0]?.nationality || labels.unknownNationality}
                </p>
              </div>
              <div className="text-right">
                <p className="text-body font-medium text-text-ink">
                  {formatDate(booking.startDate, locale)} – {formatDate(booking.endDate, locale)}
                </p>
                <p className="text-small text-text-secondary mt-4">
                  {formatCurrency(booking.totalThb, locale)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

BookingsList.displayName = 'BookingsList';
