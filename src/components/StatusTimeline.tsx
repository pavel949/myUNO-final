import React from 'react';

export interface StatusTimelineEvent {
  title: string;
  /** Pre-formatted "12 Jan 14:20 · Somchai P." style meta line. */
  meta: string;
  dotVariant?: 'success' | 'active' | 'pending';
}

interface StatusTimelineProps {
  events: StatusTimelineEvent[];
  className?: string;
}

const dotClasses: Record<NonNullable<StatusTimelineEvent['dotVariant']>, string> = {
  success: 'bg-state-success',
  active: 'bg-brand-andaman',
  pending: 'bg-text-stone-2',
};

/**
 * StatusTimeline — doc 06 §3.2: vertical event list (dot + line + timestamp
 * + text) for booking/ticket/order histories. "The reporter sees what staff
 * see" (board 02) — this is the same component whichever role is looking.
 * Events are expected newest-first; the last row in the array renders
 * without a connecting line below it.
 */
export const StatusTimeline: React.FC<StatusTimelineProps> = ({ events, className }) => {
  return (
    <div className={`flex flex-col ${className || ''}`}>
      {events.map((event, i) => {
        const isLast = i === events.length - 1;
        return (
          <div key={i} className="flex gap-12">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full mt-6 flex-shrink-0 ${dotClasses[event.dotVariant ?? 'pending']}`} />
              {!isLast && <div className="flex-1 w-px bg-border-line" />}
            </div>
            <div className={isLast ? '' : 'pb-20'}>
              <p className="text-body-strong text-text-ink">{event.title}</p>
              <p className="text-small text-text-stone">{event.meta}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
