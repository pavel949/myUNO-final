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
      <div ref={ref} className="bg-surface-paper border border-border-line rounded-md overflow-hidden">
        {bookings.map((booking, index) => (
          <div
            key={booking.id}
            className={`p-16 flex justify-between items-center gap-12 ${
              index < bookings.length - 1 ? 'border-b border-border-line' : ''
            }`}
          >
            <div>
              <p className="text-body font-semibold text-text-ink m-0">
                {[
                  booking.guestIdentity.firstName,
                  booking.guests[0]?.nationality || labels.unknownNationality,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="font-display text-small text-text-stone tabular-nums m-0">
                {formatDate(booking.startDate, locale)} – {formatDate(booking.endDate, locale)}
              </p>
            </div>
            <p className="font-display text-body font-medium text-text-ink tabular-nums m-0">
              {formatCurrency(booking.totalThb, locale)}
            </p>
          </div>
        ))}
      </div>
    );
  }
);

BookingsList.displayName = 'BookingsList';
