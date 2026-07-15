'use client';

import React from 'react';

interface StayCardProps {
  unitName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  status: string;
  checkedInAt?: string | null;
  guestNationality?: string;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-700';
    case 'checked_in':
      return 'bg-blue-100 text-blue-700';
    case 'checked_out':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-yellow-100 text-yellow-700';
  }
};

export const StayCard = React.forwardRef<HTMLDivElement, StayCardProps>(
  (
    {
      unitName,
      projectName,
      startDate,
      endDate,
      status,
      checkedInAt,
      guestNationality,
    },
    ref
  ) => {
    const isCheckedIn = status === 'checked_in';

    return (
      <div ref={ref} className="bg-gradient-to-r from-brand-andaman-soft to-brand-andaman text-text-ink rounded-lg p-32 mb-32 shadow-md">
        <div className="flex justify-between items-start mb-16">
          <div>
            <p className="text-small text-text-secondary mb-4">{projectName}</p>
            <h1 className="text-heading-2 font-bold">{unitName}</h1>
          </div>
          <span className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${getStatusBadgeColor(status)}`}>
            {status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-20 mb-24">
          <div>
            <p className="text-small text-text-secondary mb-4">Check-in</p>
            <p className="text-body font-semibold">{formatDate(startDate)}</p>
          </div>
          <div>
            <p className="text-small text-text-secondary mb-4">Check-out</p>
            <p className="text-body font-semibold">{formatDate(endDate)}</p>
          </div>
        </div>

        {isCheckedIn && (
          <div className="border-t border-brand-andaman-dark pt-16 mt-16">
            <p className="text-small font-medium">You're checked in and ready to go!</p>
            {guestNationality && (
              <p className="text-small text-text-secondary mt-4">Visiting from {guestNationality}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

StayCard.displayName = 'StayCard';
