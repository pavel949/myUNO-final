'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface TypedConfirmation {
  /** The exact text the person must retype before the confirm button enables. */
  requiredText: string;
  label: string;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** The "what happens" bullet list — every consequence stated in numbers before the person commits (CURSOR_PROMPT verification rule). */
  consequences?: string[];
  /** Heading over the consequence list (a content-key string from the caller, e.g. t('common.confirm.what_happens')). Required whenever `consequences` is passed — this component never hardcodes copy. */
  consequencesHeading?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'destructive' | 'primary';
  typedConfirmation?: TypedConfirmation;
  isLoading?: boolean;
}

/**
 * ConfirmDialog — doc 06 §3.1 / board 02: "friction scaled to stakes." Low
 * stakes never reach this component (one tap, optimistic UI, per doc06 §1
 * principle 5); this is for the deliberate steps once something is.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  consequences,
  consequencesHeading,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  typedConfirmation,
  isLoading = false,
}) => {
  const [typedValue, setTypedValue] = useState('');

  if (!open) return null;

  const confirmDisabled = typedConfirmation ? typedValue !== typedConfirmation.requiredText : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-32"
      style={{ background: 'rgba(10,55,51,.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-surface-paper rounded-lg p-24 shadow-float max-w-md w-full">
        <p id="confirm-dialog-title" className="text-title text-text-ink mb-12">
          {title}
        </p>
        {consequences && consequences.length > 0 && (
          <>
            {consequencesHeading && <p className="text-body text-text-stone mb-12">{consequencesHeading}</p>}
            <ul className="list-disc pl-20 mb-20 text-body text-text-ink">
              {consequences.map((c, i) => (
                <li key={i} className="mb-4">
                  {c}
                </li>
              ))}
            </ul>
          </>
        )}
        {typedConfirmation && (
          <div className="mb-20">
            <Input
              label={typedConfirmation.label}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={typedConfirmation.requiredText}
            />
          </div>
        )}
        <div className="flex gap-12 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
