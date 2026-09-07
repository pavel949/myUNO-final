import React from 'react';
import { FieldLabel, FieldMessage, fieldMessageId } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helpText, required, className, id, options, placeholder, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;
    const messageId = fieldMessageId(fieldId);

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={fieldId} label={label} required={required} />}
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helpText ? messageId : undefined}
          required={required}
          className={`${fieldControlWithError(error, className)} h-48 appearance-none`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldMessage error={error} helpText={helpText} id={messageId} />
      </div>
    );
  }
);

Select.displayName = 'Select';
