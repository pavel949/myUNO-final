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

/**
 * The message under a field: an error, or help text.
 *
 * Doc 06 §5 requires form errors to be announced. This used to render a plain
 * `<p>` — visible, and completely silent to a screen reader. Every field
 * primitive routes its error through here, so that one omission made
 * validation failure invisible to assistive technology across essentially
 * every form in the product. (The root `T-042_HARDENING_CHECKLIST.md` claimed
 * the opposite; `docs/T-042_hardening_checklist.md` honestly marked it
 * unverified. The honest one was right.)
 *
 * Two mechanisms, because they cover different moments:
 *
 * - `role="alert"` announces the error when it *appears* — the submit-time
 *   case, where focus is on the button and the field is elsewhere. It carries
 *   an implicit `aria-live="assertive"`, which is right for a message that
 *   blocks the person from continuing.
 * - `id` + the caller's `aria-describedby` announces it when the field is
 *   *focused* — the case where someone tabs back to fix it. Without the
 *   association the error is read as loose text, unattached to the control it
 *   is about, or missed entirely.
 *
 * Help text gets the association but no alert: it is context, not an
 * interruption, and announcing it assertively would talk over the person.
 */
export function FieldMessage({
  error,
  helpText,
  id,
}: {
  error?: string;
  helpText?: string;
  id?: string;
}) {
  if (error) {
    return (
      <p id={id} role="alert" className="text-small text-state-error">
        {error}
      </p>
    );
  }
  if (helpText) {
    return (
      <p id={id} className="text-small text-text-stone">
        {helpText}
      </p>
    );
  }
  return null;
}

/**
 * The id a field's message is published under, so the control can point at it.
 * Derived from the field's own id, so the two cannot drift apart.
 */
export function fieldMessageId(fieldId: string): string {
  return `${fieldId}-message`;
}
