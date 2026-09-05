import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, id, ...props }, ref) => {
    const fieldId = id || `checkbox-${Math.random().toString(36).slice(2, 11)}`;
    return (
      <label htmlFor={fieldId} className={`inline-flex items-center min-h-44 gap-12 cursor-pointer ${className || ''}`}>
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="h-20 w-20 rounded-sm border-border-line text-brand-andaman focus:ring-brand-andaman accent-brand-andaman"
          {...props}
        />
        <span className="text-body text-text-ink">{label}</span>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className, id, ...props }, ref) => {
    const fieldId = id || `radio-${Math.random().toString(36).slice(2, 11)}`;
    return (
      <label htmlFor={fieldId} className={`inline-flex items-center min-h-44 gap-12 cursor-pointer ${className || ''}`}>
        <input
          ref={ref}
          id={fieldId}
          type="radio"
          className="h-20 w-20 border-border-line text-brand-andaman focus:ring-brand-andaman accent-brand-andaman"
          {...props}
        />
        <span className="text-body text-text-ink">{label}</span>
      </label>
    );
  }
);
Radio.displayName = 'Radio';

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}

export function Switch({ checked, onCheckedChange, label, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex items-center min-h-44 gap-12 disabled:opacity-50 ${className || ''}`}
      {...props}
    >
      <span
        className={`relative inline-flex h-24 w-44 rounded-full transition-colors duration-micro ${
          checked ? 'bg-brand-andaman' : 'bg-border-line'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-20 w-20 rounded-full bg-surface-paper shadow-card transition-transform duration-micro ${
            checked ? 'translate-x-20' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="text-body text-text-ink">{label}</span>
    </button>
  );
}
