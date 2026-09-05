import React from 'react';
import { FieldLabel, FieldMessage } from './FieldLabel';
import { fieldControlWithError } from './fieldStyles';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helpText, required, className, id, rows = 3, ...props }, ref) => {
    const fieldId = id || `textarea-${Math.random().toString(36).slice(2, 11)}`;

    return (
      <div className="flex flex-col gap-8">
        {label && <FieldLabel htmlFor={fieldId} label={label} required={required} />}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          required={required}
          className={`${fieldControlWithError(error, className)} resize-y min-h-80`}
          {...props}
        />
        <FieldMessage error={error} helpText={helpText} />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
