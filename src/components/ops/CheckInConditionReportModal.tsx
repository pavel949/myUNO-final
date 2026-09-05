'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import {
  CHECK_IN_CHECKLIST_ITEMS,
  type CheckInChecklistItem,
} from '@/modules/ops/check-in-checklist';

const photoInputProps = {
  type: 'file' as const,
  accept: 'image/jpeg,image/png,image/webp',
  multiple: true,
};

interface CheckInConditionReportModalProps {
  bookingId: string | null;
  guestName: string;
  unitName: string;
  labels: Record<string, string>;
  onClose: () => void;
  onComplete: () => void;
}

export default function CheckInConditionReportModal({
  bookingId,
  guestName,
  unitName,
  labels,
  onClose,
  onComplete,
}: CheckInConditionReportModalProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState<CheckInChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bookingId) {
    return null;
  }

  const toggleItem = (item: CheckInChecklistItem) => {
    setChecked((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  };

  const uploadPhotos = async (files: FileList): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'photo');
      const response = await fetch('/api/media/upload', { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(labels['staff.ops.checkin.photo_upload_error']);
      }
      const data = await response.json();
      ids.push(data.mediaAssetId as string);
    }
    return ids;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checked.length === 0) {
      setError(labels['staff.ops.checkin.checklist_required']);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const files = photoInputRef.current?.files;
      const photoMediaIds = files && files.length > 0 ? await uploadPhotos(files) : [];
      const response = await fetch(`/api/bookings/${bookingId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, checklistItems: checked, photoMediaIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const title = labels['staff.ops.checkin.title']
    .replace('{guest_name}', guestName)
    .replace('{unit_name}', unitName);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-16"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-paper border border-border-line rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-24">
        <div className="flex items-start justify-between gap-16 mb-16">
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink">{title}</h2>
            <p className="text-small text-text-secondary mt-8">
              {labels['staff.ops.checkin.hint']}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-small font-semibold text-text-secondary hover:text-text-ink"
          >
            {labels['staff.ops.checkin.close']}
          </button>
        </div>

        {error ? (
          <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
            <p className="text-small text-state-error">{error}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-24">
          <section>
            <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
              {labels['staff.ops.checkin.checklist_title']}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {CHECK_IN_CHECKLIST_ITEMS.map((item) => (
                <li key={item}>
                  <label className="flex items-center gap-8 text-body text-text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.includes(item)}
                      onChange={() => toggleItem(item)}
                      className="h-16 w-16"
                    />
                    {labels[`staff.ops.checkin.checklist.${item}`]}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
              {labels['staff.ops.checkin.photos_title']}
            </h3>
            <p className="text-small text-text-secondary mb-12">
              {labels['staff.ops.checkin.photos_hint']}
            </p>
            <input ref={photoInputRef} {...photoInputProps} className="block w-full text-small" />
          </section>

          <section>
            <label className="block text-heading-3 font-semibold text-text-ink mb-12">
              {labels['staff.ops.checkin.notes_title']}
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-sm border border-border-line bg-surface-background px-12 py-8 text-body text-text-ink"
              placeholder={labels['staff.ops.checkin.notes_placeholder']}
            />
          </section>

          <Button type="submit" isLoading={busy}>
            {labels['staff.ops.checkin.submit']}
          </Button>
        </form>
      </div>
    </div>
  );
}
