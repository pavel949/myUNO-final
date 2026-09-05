'use client';

import React from 'react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}

/**
 * Sheet — board 20's mobile rule: any typed input (cash receipt, dispute,
 * order note) opens as a sheet rather than an inline row field. Slides up
 * from the bottom below `sm`; above it, behaves like the platform's other
 * centered dialogs (ConfirmDialog et al.) so desktop is unaffected.
 */
export const Sheet: React.FC<SheetProps> = ({ open, title, onClose, closeLabel, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,55,51,.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-paper w-full sm:max-w-md rounded-t-2xl sm:rounded-lg border border-border-line shadow-float max-h-[90vh] overflow-y-auto p-24">
        <div className="w-40 h-4 rounded-full bg-border-line-2 mx-auto mb-20 sm:hidden" />
        <div className="flex items-start justify-between gap-16 mb-16">
          <h2 id="sheet-title" className="text-title text-text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-small font-semibold text-text-secondary hover:text-text-ink"
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
