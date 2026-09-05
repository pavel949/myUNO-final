'use client';

import React from 'react';

interface QuickActionsRowProps {
  /** Resolved copy from the content layer — the row never writes its own. */
  labels: Record<string, string>;
  onMessageHost?: () => void;
  onOrderService?: () => void;
  onRaiseIssue?: () => void;
  onExtendStay?: () => void;
}

function ActionTile({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick?: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-80 bg-surface-paper border border-border-line rounded-md p-16 flex flex-col justify-between text-left hover:border-brand-andaman transition-colors"
    >
      <span className="text-brand-andaman" aria-hidden>
        {icon}
      </span>
      <span className="text-body font-semibold text-text-ink">{label}</span>
    </button>
  );
}

export const QuickActionsRow = React.forwardRef<HTMLDivElement, QuickActionsRowProps>(
  ({ labels, onMessageHost, onOrderService, onRaiseIssue, onExtendStay }, ref) => {
    return (
      <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-24">
        <ActionTile
          label={labels['home.action.message_host']}
          onClick={onMessageHost}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 12a8 8 0 11-3.2-6.4" />
              <path d="M4 19l1.4-3.6" />
            </svg>
          }
        />
        <ActionTile
          label={labels['home.action.order_service']}
          onClick={onOrderService}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 7h16M4 12h10M4 17h6" />
            </svg>
          }
        />
        <ActionTile
          label={labels['home.action.raise_issue']}
          onClick={onRaiseIssue}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 4l8 15H4z" />
              <path d="M12 10v4" />
            </svg>
          }
        />
        <ActionTile
          label={labels['home.action.extend_stay']}
          onClick={onExtendStay}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          }
        />
      </div>
    );
  }
);

QuickActionsRow.displayName = 'QuickActionsRow';
