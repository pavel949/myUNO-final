'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  revealLabel?: string;
  hideLabel?: string;
}

const REVEAL_TIMEOUT_MS = 15_000;

/**
 * PasswordInput — doc 06 phase 3 / canvas board 18: a 44px eye toggle inside
 * every password field, revealing in place and re-hiding after 15 seconds.
 * Typing a 10-character password blind on a phone, per the canvas note, is
 * the single most common reason people abandon the claim flow.
 *
 * The re-hide timer resets on every keystroke while revealed, so it always
 * measures 15 seconds of idle visibility rather than 15 seconds from the
 * moment the toggle was pressed.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    { label, error, required, helpText, className, id, revealLabel = 'Show password', hideLabel = 'Hide password', onChange, ...props },
    ref
  ) => {
    const [revealed, setRevealed] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputId = id || `password-${Math.random().toString(36).substr(2, 9)}`;

    const clearHideTimer = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };

    const scheduleHide = () => {
      clearHideTimer();
      hideTimer.current = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    };

    useEffect(() => clearHideTimer, []);

    const toggleReveal = () => {
      setRevealed((was) => {
        const next = !was;
        if (next) scheduleHide();
        else clearHideTimer();
        return next;
      });
    };

    return (
      <div className="flex flex-col gap-8">
        {label && (
          <label htmlFor={inputId} className="text-small text-text-stone">
            {label}
            {required && <span className="text-state-error ml-4">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={revealed ? 'text' : 'password'}
            onChange={(e) => {
              if (revealed) scheduleHide();
              onChange?.(e);
            }}
            className={`
              h-48 pl-16 pr-48 py-12 rounded-sm w-full
              bg-surface-paper border border-border-line
              text-text-ink placeholder:text-text-stone-2
              focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:ring-offset-2 focus:outline-none
              disabled:bg-surface-paper disabled:text-text-stone-2 disabled:cursor-not-allowed
              transition-colors duration-micro
              ${error ? 'border-state-error' : ''}
              ${className || ''}
            `}
            {...props}
          />
          <button
            type="button"
            aria-label={revealed ? hideLabel : revealLabel}
            onClick={toggleReveal}
            className="absolute right-0 top-0 w-44 h-48 flex items-center justify-center text-brand-andaman"
          >
            {revealed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M4 20L20 4" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
        {error && <p className="text-small text-state-error">{error}</p>}
        {helpText && !error && <p className="text-small text-text-stone">{helpText}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
