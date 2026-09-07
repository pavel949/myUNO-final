'use client';

import React, { useEffect, useState } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children, footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-24">
      {/* Scrim per doc 06 §3.1 */}
      <div
        className="fixed inset-0 bg-brand-deep/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal on desktop / Drawer-sheet on mobile */}
      <div
        className="relative w-full max-w-lg bg-surface-paper border border-border-line rounded-t-lg sm:rounded-lg shadow-float p-20 sm:p-24 z-10 max-h-[90vh] flex flex-col transition-all transform"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div className="flex items-center justify-between pb-12 border-b border-border-line">
          <div>
            {title && (
              <h3 id="modal-title" className="font-display text-title text-text-ink">
                {title}
              </h3>
            )}
            {description && <p className="text-small text-text-stone mt-4">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-stone hover:text-text-ink p-8 rounded-sm text-subtitle font-bold"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="py-16 overflow-y-auto flex-1">{children}</div>

        {footer && <div className="pt-16 border-t border-border-line flex justify-end gap-12">{footer}</div>}
      </div>
    </div>
  );
}
