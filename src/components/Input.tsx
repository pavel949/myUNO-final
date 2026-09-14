'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FieldLabel, FieldMessage, fieldMessageId } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, helpText, className, id, type, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const messageId = fieldMessageId(inputId);

    const [showPassword, setShowPassword] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const isPassword = type === 'password';

    useEffect(() => {
      if (showPassword) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setShowPassword(false);
        }, 15000); // Re-hide after 15 seconds
      }
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [showPassword]);

    const togglePassword = () => {
      setShowPassword((prev) => !prev);
    };

    const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={inputId} label={label} required={required} />}
        <div className="relative flex items-center w-full">
          <input
            ref={ref}
            id={inputId}
            type={currentType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helpText ? messageId : undefined}
            className={`${fieldControlWithError(error, className)} h-48 ${isPassword ? 'pr-48' : ''}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={togglePassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 flex items-center justify-center w-44 h-44 text-text-stone hover:text-text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand-andaman rounded-sm"
            >
              {showPassword ? (
                /* Eye Off Icon */
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.016 10.016 0 012.122-.063c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18"
                  />
                </svg>
              ) : (
                /* Eye Icon */
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
        <FieldMessage error={error} helpText={helpText} id={messageId} />
      </div>
    );
  }
);

Input.displayName = 'Input';
