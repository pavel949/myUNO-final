'use client';

import { Sheet } from './Sheet';
import { Textarea } from './Textarea';
import { Button } from './Button';

interface NoteSheetProps {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  title: string;
  noteLabel: string;
  value: string;
  onChange: (value: string) => void;
  submitLabel: string;
  requiredHint?: string;
  error?: string | null;
  /** When true, the note may be left blank — submit is never disabled for emptiness. Defaults to false (a note is required). */
  optional?: boolean;
  busy: boolean;
  onSubmit: () => void;
}

/**
 * NoteSheet — board 20 rule 3: any typed note (a ticket resolution, a
 * decline reason, a statement dispute) opens as a sheet rather than a
 * native `window.prompt()` or a field wedged into a row.
 */
export function NoteSheet({
  open,
  onClose,
  closeLabel,
  title,
  noteLabel,
  value,
  onChange,
  submitLabel,
  requiredHint,
  error,
  optional = false,
  busy,
  onSubmit,
}: NoteSheetProps) {
  const ready = optional || value.trim().length > 0;

  return (
    <Sheet open={open} onClose={onClose} closeLabel={closeLabel} title={title}>
      <div className="mb-16">
        <Textarea
          label={noteLabel}
          required={!optional}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      </div>
      {error && (
        <p role="alert" className="text-body text-state-error mb-16">
          {error}
        </p>
      )}
      <Button fullWidth variant="primary" disabled={!ready} isLoading={busy} onClick={onSubmit}>
        {submitLabel}
      </Button>
      {requiredHint && (
        <p className="text-small text-text-secondary text-center mt-8">{requiredHint}</p>
      )}
    </Sheet>
  );
}
