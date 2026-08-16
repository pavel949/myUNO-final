'use client';

import React from 'react';
import { Button } from '@/components/Button';

interface ExtendStayPanelProps {
  /** Current check-out date (ISO) — the earliest a new end date can beat. */
  currentEndDate: string;
  isLoading?: boolean;
  error?: string | null;
  labels: Record<string, string>;
  onExtend: (newEndDate: string) => void;
}

function nextDay(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * In-stay extension entry (doc 07 F-GUEST-7). A stay under way can only move
 * one way — later — so this asks for the one thing that can change and hands
 * it to the F-GUEST-9 modification endpoint, which re-checks availability and
 * prices the added nights server-side.
 */
export const ExtendStayPanel = React.forwardRef<HTMLDivElement, ExtendStayPanelProps>(
  ({ currentEndDate, isLoading, error, labels, onExtend }, ref) => {
    const earliest = nextDay(currentEndDate);
    const [newEndDate, setNewEndDate] = React.useState(earliest);

    return (
      <div
        ref={ref}
        className="bg-surface-paper border border-border-line rounded-md p-32 mb-24"
      >
        <h2 className="text-heading-2 font-semibold text-text-ink mb-8">
          {labels['home.extend.title']}
        </h2>
        <p className="text-body text-text-secondary mb-20">{labels['home.extend.description']}</p>

        <form
          className="flex flex-wrap items-end gap-12"
          onSubmit={(e) => {
            e.preventDefault();
            onExtend(newEndDate);
          }}
        >
          <div className="flex flex-col gap-4">
            <label htmlFor="extend-end-date" className="text-small text-text-secondary">
              {labels['home.extend.new_end_date']}
            </label>
            <input
              id="extend-end-date"
              type="date"
              min={earliest}
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
            />
          </div>

          <Button type="submit" variant="sun" isLoading={isLoading} disabled={!newEndDate}>
            {labels['home.extend.submit']}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-small text-state-error mt-12">
            {error}
          </p>
        ) : null}

        <p className="text-small text-text-secondary mt-12">{labels['home.extend.note']}</p>
      </div>
    );
  }
);

ExtendStayPanel.displayName = 'ExtendStayPanel';
