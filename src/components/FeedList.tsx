'use client';

import React from 'react';

export interface FeedItem {
  id: string;
  title: string;
  caption?: string;
  body?: string;
  timestamp: string;
  unread?: boolean;
  avatarInitials?: string;
}

export interface FeedListProps {
  items: FeedItem[];
  onItemClick?: (item: FeedItem) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function FeedList({
  items,
  onItemClick,
  emptyTitle = 'No updates',
  emptyDescription = 'When new messages or activity arrive, they will appear here.',
}: FeedListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <p className="font-display text-subtitle text-text-ink mb-4">{emptyTitle}</p>
        <p className="text-small text-text-stone">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick?.(item)}
          className={`p-16 rounded-lg border transition-all duration-micro cursor-pointer flex items-start gap-12 ${
            item.unread
              ? 'bg-surface-paper border-brand-andaman/30 shadow-card'
              : 'bg-surface-paper border-border-line hover:border-border-line-2'
          }`}
        >
          {item.unread && (
            <span className="w-8 h-8 rounded-full bg-brand-sun mt-6 shrink-0" aria-label="Unread" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-8 mb-4">
              <h4 className="font-display text-subtitle text-text-ink truncate">{item.title}</h4>
              <span className="text-small text-text-stone shrink-0">{item.timestamp}</span>
            </div>
            {item.caption && <p className="text-small text-text-stone mb-4">{item.caption}</p>}
            {item.body && <p className="text-body text-text-ink line-clamp-2">{item.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
