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

type Labels = Record<string, string>;

export default function OnboardingStateClient({
  projectId,
  templates,
  initialDraft,
  labels,
}: {
  projectId: string;
  templates: Template[];
  initialDraft: Draft;
  labels: Labels;
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
        if (!response.ok) throw new Error('onboarding_autosave_failed');
        setState('saved');
      } catch {
        setState('error');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectId, templateId, lastStage, notes]);

  const stateLabel =
    state === 'saving'
      ? labels['admin.project_onboarding.autosave_saving']
      : state === 'saved'
        ? labels['admin.project_onboarding.autosave_saved']
        : state === 'error'
          ? labels['admin.project_onboarding.autosave_failed']
          : '';

  return (
    <section className="rounded-xl border border-border-line bg-surface-paper p-20">
      <div className="flex flex-wrap items-end justify-between gap-16">
        <div>
          <h2 className="text-subtitle font-semibold text-text-ink">
            {labels['admin.project_onboarding.setup_title']}
          </h2>
          <p className="mt-4 text-small text-text-secondary">
            {labels['admin.project_onboarding.setup_description']}
          </p>
        </div>
        <span className="text-small text-text-secondary" aria-live="polite">
          {stateLabel}
        </span>
      </div>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <label className="flex flex-col gap-4 text-small text-text-secondary">
          {labels['admin.project_onboarding.template_label']}
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
          >
            <option value="">{labels['admin.project_onboarding.no_template']}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-4 text-small text-text-secondary">
          {labels['admin.project_onboarding.resume_stage']}
          <select
            value={lastStage}
            onChange={(event) => setLastStage(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
          >
            <option value="identity">{labels['admin.project_onboarding.stage_identity']}</option>
            <option value="inventory">{labels['admin.project_onboarding.stage_inventory']}</option>
            <option value="commercial">{labels['admin.project_onboarding.stage_commercial']}</option>
            <option value="compliance">{labels['admin.project_onboarding.stage_compliance']}</option>
            <option value="operations">{labels['admin.project_onboarding.stage_operations']}</option>
            <option value="publish">{labels['admin.project_onboarding.stage_publish']}</option>
          </select>
        </label>
        <label className="flex flex-col gap-4 text-small text-text-secondary md:col-span-1">
          {labels['admin.project_onboarding.working_notes']}
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-text-ink"
            placeholder={labels['admin.project_onboarding.working_notes_placeholder']}
          />
        </label>
      </div>
    </section>
  );
}
