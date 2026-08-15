'use client';

import { FC, useState } from 'react';
import type { CrmActivityType } from '@prisma/client';

interface QuickActivityFormProps {
  opportunityId: string;
  onActivityAdded?: () => void;
}

const ACTIVITY_TYPES: Array<{ value: CrmActivityType; label: string; icon: string }> = [
  { value: 'note', label: 'Note', icon: '📝' },
  { value: 'task', label: 'Task', icon: '✅' },
  { value: 'call', label: 'Call', icon: '☎️' },
  { value: 'meeting', label: 'Meeting', icon: '📅' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
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
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
      >
        + Log an activity
      </button>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400'
                }`}
              >
                <div className="text-lg">{actType.icon}</div>
                <div className="text-xs font-medium mt-1">{actType.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What happened or needs to happen?"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Details
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add more context..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
          />
        </div>

        {type === 'task' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Due date
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-3 rounded text-sm">
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
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !subject.trim()}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            {isLoading ? 'Adding...' : 'Add activity'}
          </button>
        </div>
      </form>
    </div>
  );
};
