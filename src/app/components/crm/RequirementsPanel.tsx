'use client';

import { FC, useState, useEffect } from 'react';

interface RequirementsPanelProps {
  opportunityId: string;
  requirements: any;
}

export const RequirementsPanel: FC<RequirementsPanelProps> = ({
  opportunityId,
  requirements: initialRequirements,
}) => {
  const [requirements, setRequirements] = useState<any>(
    initialRequirements || {}
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(
    JSON.stringify(requirements, null, 2)
  );

  useEffect(() => {
    setEditValue(JSON.stringify(requirements, null, 2));
  }, [requirements]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const parsed = JSON.parse(editValue);

      const response = await fetch(
        `/api/crm/opportunities/${opportunityId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirements: parsed }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save requirements');
      }

      setRequirements(parsed);
      setIsEditing(false);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(err.message || 'Failed to save requirements');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-ink  mb-2">
            Deal requirements (JSON)
          </label>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-border-line  rounded-lg bg-surface-paper text-text-ink  font-mono text-sm resize-vertical"
          />
        </div>

        {error && (
          <div className="bg-state-error-soft text-state-error p-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              setIsEditing(false);
              setEditValue(JSON.stringify(requirements, null, 2));
              setError(null);
            }}
            disabled={isSaving}
            className="px-4 py-2 text-text-ink  hover:bg-surface-ivory  rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-brand-andaman text-surface-ivory hover:bg-brand-deep disabled:opacity-50 rounded-lg transition-colors font-medium"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.keys(requirements).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-stone  mb-4">
            No requirements set yet
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-brand-andaman text-surface-ivory hover:bg-brand-deep rounded-lg transition-colors font-medium"
          >
            Add requirements
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface-ivory p-4 rounded-lg border border-border-line ">
            <pre className="text-sm text-text-ink  overflow-auto max-h-96">
              {JSON.stringify(requirements, null, 2)}
            </pre>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-brand-andaman text-surface-ivory hover:bg-brand-deep rounded-lg transition-colors font-medium"
          >
            Edit requirements
          </button>
        </>
      )}
    </div>
  );
};
