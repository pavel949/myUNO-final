import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}

/**
 * Select — same chrome as Input (doc 06 §3.1: "Select, Combobox — same
 * chrome"). A native <select>, not a custom listbox: it gets the OS's own
 * keyboard and screen-reader behaviour for free, which a hand-rolled
 * popover has to reimplement from scratch.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, helpText, className, id, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex flex-col gap-8">
        {label && (
          <label htmlFor={selectId} className="text-small text-text-stone">
            {label}
            {required && <span className="text-state-error ml-4">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            h-48 px-16 rounded-sm
            bg-surface-paper border border-border-line
            text-text-ink
            focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:ring-offset-2 focus:outline-none
            disabled:bg-surface-paper disabled:text-text-stone-2 disabled:cursor-not-allowed
            transition-colors duration-micro
            ${error ? 'border-state-error' : ''}
            ${className || ''}
          `}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-small text-state-error">{error}</p>}
        {helpText && !error && <p className="text-small text-text-stone">{helpText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
