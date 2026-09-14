'use client';

import React from 'react';
import { FieldLabel, FieldMessage, fieldMessageId } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

/**
 * How long a revealed password stays revealed (board 18).
 *
 * Revealing is for checking a typo, not for leaving on screen. Someone who
 * reveals and then walks away, or hands the phone over, should not still be
 * showing it — so it re-hides itself rather than relying on the person to
 * remember. Fifteen seconds is long enough to read a long passphrase back.
 */
export const REVEAL_TIMEOUT_MS = 15_000;

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  /** Content-layer label for the toggle when the password is hidden. */
  showLabel: string;
  /** Content-layer label for the toggle when the password is revealed. */
  hideLabel: string;
}

/**
 * A password field with a reveal toggle (board 18).
 *
 * The toggle is a 44px target — the mobile hit-size floor from doc 06 §5 —
 * and sits inside the field rather than beside it, so the control belongs to
 * the input it governs. It reveals in place and re-hides itself after
 * REVEAL_TIMEOUT_MS.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, required, helpText, className, id, showLabel, hideLabel, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const messageId = fieldMessageId(inputId);
    const [revealed, setRevealed] = React.useState(false);

    React.useEffect(() => {
      if (!revealed) return;
      const timer = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, [revealed]);

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={inputId} label={label} required={required} />}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={revealed ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helpText ? messageId : undefined}
            // Room for the toggle, so a long value never runs under it.
            className={`${fieldControlWithError(error, className)} h-48 pr-48`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setRevealed((wasRevealed) => !wasRevealed)}
            aria-label={revealed ? hideLabel : showLabel}
            aria-pressed={revealed}
            aria-controls={inputId}
            className="absolute right-0 top-1/2 -translate-y-1/2 h-44 w-44 flex items-center justify-center text-text-stone hover:text-text-ink rounded-sm transition-colors duration-micro"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
              {revealed ? <line x1="4" y1="20" x2="20" y2="4" /> : null}
            </svg>
          </button>
        </div>
        <FieldMessage error={error} helpText={helpText} id={messageId} />
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
