import React from 'react';
import { FieldLabel, FieldMessage, fieldMessageId } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, helpText, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const messageId = fieldMessageId(inputId);

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={inputId} label={label} required={required} />}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helpText ? messageId : undefined}
          className={`${fieldControlWithError(error, className)} h-48`}
          {...props}
        />
        <FieldMessage error={error} helpText={helpText} id={messageId} />
      </div>
    );
  }
);

Input.displayName = 'Input';
