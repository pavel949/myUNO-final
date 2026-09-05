'use client';

import React from 'react';
import { Chip } from '@/components/Chip';
import { TrustMark } from '@/components/TrustMark';

interface StayCardProps {
  unitName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  status: string;
  checkedInAt?: string | null;
  guestNationality?: string;
  nights: number;
  guestCount: number;
  tm30Filed?: boolean;
  paidInFull?: boolean;
  /** Only pass a real door code from the stay. Never invent one. */
  doorCode?: string | null;
  doorCodeHint?: string | null;
  /** Resolved copy from the content layer — the card never writes its own. */
  labels: Record<string, string>;
}

const formatStayRange = (startStr: string, endStr: string): string => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
};

const stayChipStatus = (status: string): 'checked_in' | 'confirmed' | 'cancelled' | 'closed' | 'default' => {
  switch (status) {
    case 'checked_in':
      return 'checked_in';
    case 'confirmed':
      return 'confirmed';
    case 'cancelled':
    case 'declined':
      return 'cancelled';
    case 'checked_out':
    case 'completed':
      return 'closed';
    default:
      return 'default';
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
      guestNationality,
      nights,
      guestCount,
      tm30Filed = false,
      paidInFull = false,
      doorCode,
      doorCodeHint,
      labels,
    },
    ref
  ) => {
    const nightsLabel = (labels['home.stay.nights_count'] ?? '').replace(
      '{count}',
      String(nights)
    );
    const guestsLabel = (labels['listing.guests_count'] ?? '').replace(
      '{count}',
      String(guestCount)
    );
    const meta = [formatStayRange(startDate, endDate), nightsLabel, guestsLabel]
      .filter(Boolean)
      .join(' · ');

    const doorBlock = doorCode ? (
      <div className="bg-surface-ivory rounded-sm p-16 text-center">
        <p className="text-small text-text-stone m-0 mb-4">{labels['home.stay.door_code']}</p>
        <p className="font-display text-display font-semibold tracking-[4px] tabular-nums m-0">
          {doorCode}
        </p>
        {doorCodeHint ? (
          <p className="text-small text-text-stone mt-8 m-0">{doorCodeHint}</p>
        ) : null}
      </div>
    ) : null;

    return (
      <div
        ref={ref}
        className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24 lg:grid lg:grid-cols-[1fr_200px] lg:gap-24 lg:items-start"
      >
        <div>
          <p className="font-display text-kicker uppercase text-brand-sun m-0 mb-12">
            {labels['home.stay.kicker']}
          </p>
          <h2 className="font-display text-title font-semibold text-text-ink m-0 mb-4">
            {unitName}
          </h2>
          <p className="text-small text-text-stone m-0 mb-4">{projectName}</p>
          <p className="font-display text-body text-text-stone tabular-nums m-0 mb-16">{meta}</p>

          <div className="flex flex-wrap gap-8 mb-16">
            <Chip variant="status" status={stayChipStatus(status)}>
              {labels[`home.stay_status.${status}`] ?? status.replace('_', ' ')}
            </Chip>
            {tm30Filed ? (
              <Chip
                variant="status"
                status="confirmed"
                icon={<TrustMark size={14} />}
              >
                {labels['home.stay.tm30_filed']}
              </Chip>
            ) : null}
            {paidInFull ? (
              <Chip variant="status" status="confirmed">
                {labels['home.stay.paid_in_full']}
              </Chip>
            ) : null}
          </div>

          {guestNationality ? (
            <p className="text-small text-text-stone m-0">
              {(labels['home.stay.visiting_from'] ?? '').replace(
                '{nationality}',
                guestNationality
              )}
            </p>
          ) : null}
        </div>

        {doorBlock ? <div className="mt-16 lg:mt-0">{doorBlock}</div> : null}
      </div>
    );
  }
);

StayCard.displayName = 'StayCard';
