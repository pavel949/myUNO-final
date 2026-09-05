import React from 'react';

export type TimelineTone = 'success' | 'info' | 'muted';

export interface StatusTimelineEvent {
  id: string;
  title: string;
  detail: string;
  tone?: TimelineTone;
}

const dotClass: Record<TimelineTone, string> = {
  success: 'bg-state-success',
  info: 'bg-brand-andaman',
  muted: 'bg-text-stone-2',
};

export function StatusTimeline({ events }: { events: StatusTimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const tone = event.tone ?? 'muted';
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="flex gap-12">
            <div className="flex flex-col items-center">
              <span className={`w-10 h-10 rounded-full mt-6 ${dotClass[tone]}`} />
              {!last && <span className="flex-1 w-px bg-border-line" />}
            </div>
            <div className={last ? '' : 'pb-20'}>
              <p className="text-body-strong text-text-ink m-0">{event.title}</p>
              <p className="text-small text-text-stone m-0">{event.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
