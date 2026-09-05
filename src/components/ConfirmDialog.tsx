'use client';

import React, { useEffect, useId, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  whatHappensLabel?: string;
  consequences: string[];
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  typedConfirmation?: {
    phrase: string;
    prompt: string;
  };
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  whatHappensLabel,
  consequences,
  cancelLabel,
  confirmLabel,
  destructive = true,
  typedConfirmation,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const [typed, setTyped] = useState('');
  const typedOk = !typedConfirmation || typed === typedConfirmation.phrase;

  useEffect(() => {
    if (!open) {
      setTyped('');
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,55,51,0.5)] p-16"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-surface-paper rounded-lg p-24 shadow-float"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-title text-text-ink mb-12">
          {title}
        </h2>
        {whatHappensLabel && (
          <p className="text-body text-text-stone mb-12">{whatHappensLabel}</p>
        )}
        {consequences.length > 0 && (
          <ul className="mb-20 pl-20 list-disc text-body text-text-ink space-y-4">
            {consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {typedConfirmation && (
          <div className="mb-20">
            <Input
              label={typedConfirmation.prompt}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-12 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={!typedOk}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
