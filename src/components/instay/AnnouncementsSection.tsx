'use client';

import React from 'react';
import { Chip } from '@/components/Chip';

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
  postedAs?: string;
}

interface AnnouncementsSectionProps {
  announcements: Announcement[];
  labels: Record<string, string>;
}

const voiceChipStatus = 'closed' as const;

export const AnnouncementsSection = React.forwardRef<HTMLDivElement, AnnouncementsSectionProps>(
  ({ announcements, labels }, ref) => {
    if (!announcements || announcements.length === 0) {
      return null;
    }

    return (
      <div ref={ref} className="mb-24">
        <p className="font-display text-kicker uppercase text-brand-sun m-0 mb-12">
          {labels['home.announcements.kicker']}
        </p>
        <div className="space-y-12">
          {announcements.map((announcement) => {
            const voiceKey = announcement.postedAs
              ? `home.announcement.voice.${announcement.postedAs}`
              : '';
            const voice = voiceKey ? labels[voiceKey] : '';

            return (
              <div
                key={announcement.id}
                className="bg-surface-paper border border-border-line rounded-md p-16"
              >
                <div className="flex flex-wrap items-center gap-8 mb-8">
                  <h3 className="text-body font-semibold text-text-ink m-0">
                    {announcement.title}
                  </h3>
                  {voice ? (
                    <Chip variant="status" status={voiceChipStatus}>
                      {voice}
                    </Chip>
                  ) : null}
                </div>
                <p className="text-small text-text-stone m-0">{announcement.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

AnnouncementsSection.displayName = 'AnnouncementsSection';
