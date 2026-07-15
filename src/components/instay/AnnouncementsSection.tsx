'use client';

import React from 'react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
}

interface AnnouncementsSectionProps {
  announcements: Announcement[];
}

export const AnnouncementsSection = React.forwardRef<HTMLDivElement, AnnouncementsSectionProps>(
  ({ announcements }, ref) => {
    if (!announcements || announcements.length === 0) {
      return null;
    }

    return (
      <div ref={ref} className="mb-40">
        <h2 className="text-heading-2 font-semibold text-text-ink mb-16">Announcements</h2>
        <div className="space-y-12">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="border border-brand-andaman-soft rounded-md p-20 bg-brand-andaman-soft bg-opacity-20">
              <h3 className="text-body font-semibold text-text-ink mb-8">{announcement.title}</h3>
              <p className="text-body text-text-secondary">{announcement.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

AnnouncementsSection.displayName = 'AnnouncementsSection';
