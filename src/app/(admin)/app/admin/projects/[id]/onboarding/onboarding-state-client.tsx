'use client';

import { useEffect, useMemo, useState } from 'react';

type Template = {
  id: string;
  name: string;
  propertyType: string;
  configuration: unknown;
};

type Draft = {
  templateId: string | null;
  lastStage: string | null;
  stageData: unknown;
  autosavedAt: string | Date;
} | null;

export default function OnboardingStateClient({
  projectId,
  templates,
  initialDraft,
}: {
  projectId: string;
  templates: Template[];
  initialDraft: Draft;
}) {
  const initialNotes = useMemo(() => {
    const data = (initialDraft?.stageData || {}) as Record<string, unknown>;
    return typeof data.notes === 'string' ? data.notes : '';
  }, [initialDraft]);
  const [templateId, setTemplateId] = useState(initialDraft?.templateId || '');
  const [lastStage, setLastStage] = useState(initialDraft?.lastStage || 'identity');
  const [notes, setNotes] = useState(initialNotes);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(async () => {
      setState('saving');
      try {
        const response = await fetch(`/api/admin/projects/${projectId}/onboarding-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: templateId || null,
            lastStage,
            stageData: { notes },
          }),
        });
        if (!response.ok) throw new Error('autosave failed');
        setState('saved');
      } catch {
        setState('error');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectId, templateId, lastStage, notes]);

  return (
    <section className="rounded-xl border border-border-line bg-surface-paper p-20">
      <div className="flex flex-wrap items-end justify-between gap-16">
        <div>
          <h2 className="text-subtitle font-semibold text-text-ink">Setup template & progress</h2>
          <p className="mt-4 text-small text-text-secondary">
            Template values are inherited defaults only. Operational editors remain the source of truth.
          </p>
        </div>
        <span className="text-small text-text-secondary" aria-live="polite">
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Autosave failed' : ''}
        </span>
      </div>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <label className="flex flex-col gap-4 text-small text-text-secondary">
          Template
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
          >
            <option value="">No template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-4 text-small text-text-secondary">
          Resume at stage
          <select
            value={lastStage}
            onChange={(event) => setLastStage(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
          >
            <option value="identity">1. Property identity</option>
            <option value="inventory">2. Units & inventory</option>
            <option value="commercial">3. Pricing & commercial rules</option>
            <option value="compliance">4. Compliance & authority</option>
            <option value="operations">5. Team & services</option>
            <option value="publish">6. Content & launch</option>
          </select>
        </label>
        <label className="flex flex-col gap-4 text-small text-text-secondary md:col-span-1">
          Working notes
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
            placeholder="What still needs attention?"
          />
        </label>
      </div>
    </section>
  );
}
