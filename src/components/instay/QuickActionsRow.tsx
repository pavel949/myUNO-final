'use client';

import React from 'react';
import { Button } from '@/components';

interface QuickActionsRowProps {
  /** Resolved copy from the content layer — the row never writes its own. */
  labels: Record<string, string>;
  onMessageHost?: () => void;
  onOrderService?: () => void;
  onRaiseIssue?: () => void;
  onExtendStay?: () => void;
}

export const QuickActionsRow = React.forwardRef<HTMLDivElement, QuickActionsRowProps>(
  ({ labels, onMessageHost, onOrderService, onRaiseIssue, onExtendStay }, ref) => {
    return (
      <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-40">
        <Button
          variant="secondary"
          fullWidth
          onClick={onMessageHost}
          className="text-body"
        >
          {labels['home.action.message_host']}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onOrderService}
          className="text-body"
        >
          {labels['home.action.order_service']}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onRaiseIssue}
          className="text-body"
        >
          {labels['home.action.raise_issue']}
        </Button>
        <Button
          variant="sun"
          fullWidth
          onClick={onExtendStay}
          className="text-body"
        >
          {labels['home.action.extend_stay']}
        </Button>
      </div>
    );
  }
);

QuickActionsRow.displayName = 'QuickActionsRow';
