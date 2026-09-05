import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, helpText, className, id, rows = 3, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex flex-col gap-8">
        {label && (
          <label htmlFor={textareaId} className="text-small text-text-stone">
            {label}
            {required && <span className="text-state-error ml-4">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`
            px-16 py-12 rounded-sm
            bg-surface-paper border border-border-line
            text-text-ink placeholder:text-text-stone-2
            focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:ring-offset-2 focus:outline-none
            disabled:bg-surface-paper disabled:text-text-stone-2 disabled:cursor-not-allowed
            transition-colors duration-micro resize-y
            ${error ? 'border-state-error' : ''}
            ${className || ''}
          `}
          {...props}
        />
        {error && <p className="text-small text-state-error">{error}</p>}
        {helpText && !error && <p className="text-small text-text-stone">{helpText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
