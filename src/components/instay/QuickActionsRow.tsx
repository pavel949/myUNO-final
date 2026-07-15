'use client';

import React from 'react';
import { Button } from '@/components';

interface QuickActionsRowProps {
  onMessageHost?: () => void;
  onOrderService?: () => void;
  onRaiseIssue?: () => void;
  onExtendStay?: () => void;
}

export const QuickActionsRow = React.forwardRef<HTMLDivElement, QuickActionsRowProps>(
  ({ onMessageHost, onOrderService, onRaiseIssue, onExtendStay }, ref) => {
    return (
      <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-40">
        <Button
          variant="secondary"
          fullWidth
          onClick={onMessageHost}
          className="text-body"
        >
          💬 Message Host
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onOrderService}
          className="text-body"
        >
          🛠️ Order Service
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onRaiseIssue}
          className="text-body"
        >
          🚨 Raise Issue
        </Button>
        <Button
          variant="sun"
          fullWidth
          onClick={onExtendStay}
          className="text-body"
        >
          📅 Extend Stay
        </Button>
      </div>
    );
  }
);

QuickActionsRow.displayName = 'QuickActionsRow';
