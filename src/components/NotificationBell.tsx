'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface BellLabels {
  aria: string;
  empty: string;
  markAll: string;
}

/**
 * Navbar bell: polls the notifications API (30s), shows unread badge +
 * dropdown. Titles/bodies arrive already resolved by the content layer.
 */
export function NotificationBell({ labels }: { labels: BellLabels }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'POST' }).catch(() => {});
    await load();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={labels.aria}
        className="relative flex items-center justify-center w-44 h-44 text-text-ink hover:text-brand-andaman"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.5l-1.6 3.2a.7.7 0 0 0 .63 1.01h13.94a.7.7 0 0 0 .63-1.01L18 12.5V9a6 6 0 0 0-6-6zM9.5 18.5a2.5 2.5 0 0 0 5 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute top-4 right-4 min-w-16 h-16 px-4 rounded-full bg-state-error text-surface-ivory text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-56 w-80 md:w-96 bg-surface-paper border border-border-line rounded-lg shadow-float z-50 overflow-hidden" style={{ width: '320px' }}>
          {items.length === 0 ? (
            <p className="text-small text-text-secondary p-16">{labels.empty}</p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto" style={{ maxHeight: '360px' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-12 border-b border-border-line last:border-b-0 ${
                      item.readAt ? '' : 'bg-state-info-soft'
                    }`}
                  >
                    <p className="text-small font-semibold text-text-ink">{item.title}</p>
                    <p className="text-small text-text-secondary">{item.body}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={markAll}
                className="w-full p-12 text-small font-semibold text-brand-andaman hover:bg-surface-ivory"
              >
                {labels.markAll}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
