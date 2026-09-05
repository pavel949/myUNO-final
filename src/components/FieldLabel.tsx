import React from 'react';

export function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-small text-text-stone">
      {label}
      {required && <span className="text-state-error ml-4">*</span>}
    </label>
  );
}

export function FieldMessage({ error, helpText }: { error?: string; helpText?: string }) {
  if (error) {
    return <p className="text-small text-state-error">{error}</p>;
  }
  if (helpText) {
    return <p className="text-small text-text-stone">{helpText}</p>;
  }
  return null;
}
