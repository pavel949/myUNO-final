'use client';

import { FC, useState } from 'react';
import type { CrmActivityType } from '@prisma/client';

interface QuickActivityFormProps {
  opportunityId: string;
  onActivityAdded?: () => void;
}

const ACTIVITY_TYPES: Array<{ value: CrmActivityType; label: string }> = [
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
];

export const QuickActivityForm: FC<QuickActivityFormProps> = ({
  opportunityId,
  onActivityAdded,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<CrmActivityType>('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/crm/opportunities/${opportunityId}/activities`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            subject: subject.trim(),
            body: body.trim() || null,
            dueAt: dueAt || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create activity');
      }

      setSubject('');
      setBody('');
      setDueAt('');
      setType('note');
      setIsOpen(false);
      onActivityAdded?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create activity');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 px-4 border-2 border-dashed border-border-line rounded-lg text-text-ink hover:border-brand-andaman hover:text-brand-andaman transition-colors font-medium"
      >
        + Log an activity
      </button>
    );
  }

  return (
    <div className="bg-surface-ivory p-4 rounded-lg border border-border-line ">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-ink  mb-2">
            Activity type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITY_TYPES.map((actType) => (
              <button
                key={actType.value}
                type="button"
                onClick={() => setType(actType.value)}
                className={`p-2 rounded text-center transition-colors ${
                  type === actType.value
                    ? 'bg-brand-andaman text-surface-ivory'
                    : 'bg-surface-paper border border-border-line  text-text-ink  hover:border-brand-andaman '
                }`}
              >
                <div className="text-small font-medium">{actType.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-ink  mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What happened or needs to happen?"
            className="w-full px-3 py-2 border border-border-line  rounded-lg bg-surface-paper text-text-ink  placeholder:text-text-stone-2 "
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-ink  mb-2">
            Details
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add more context..."
            rows={3}
            className="w-full px-3 py-2 border border-border-line  rounded-lg bg-surface-paper text-text-ink  placeholder:text-text-stone-2  resize-none"
          />
        </div>

        {type === 'task' && (
          <div>
            <label className="block text-sm font-medium text-text-ink  mb-2">
              Due date
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-border-line  rounded-lg bg-surface-paper text-text-ink "
            />
          </div>
        )}

        {error && (
          <div className="bg-state-error-soft text-state-error p-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSubject('');
              setBody('');
              setDueAt('');
              setError(null);
            }}
            disabled={isLoading}
            className="px-4 py-2 text-text-ink  hover:bg-surface-ivory  rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !subject.trim()}
            className="px-4 py-2 bg-brand-andaman text-surface-ivory hover:bg-brand-deep disabled:opacity-50 rounded-lg transition-colors font-medium"
          >
            {isLoading ? 'Adding...' : 'Add activity'}
          </button>
        </div>
      </form>
    </div>
  );
};
