import React from 'react';
import { FieldLabel, FieldMessage } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, helpText, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={inputId} label={label} required={required} />}
        <input
          ref={ref}
          id={inputId}
          className={`${fieldControlWithError(error, className)} h-48`}
          {...props}
        />
        <FieldMessage error={error} helpText={helpText} />
      </div>
    );
  }
);

Input.displayName = 'Input';
