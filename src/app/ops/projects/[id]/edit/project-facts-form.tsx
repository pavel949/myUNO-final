'use client';
import { usePropertyEdit } from '@/components/property/usePropertyEdit';
import { editorLabel, type PropertyEditorCopy } from '@/modules/content/property-editor.seed';
type Project = {
  id: string;
  name: string;
  brand: string | null;
  address: string;
  city: string | null;
  district: string | null;
  projectType: string | null;
  totalUnits: number | null;
  updatedAt: string;
};
export default function ProjectFactsForm({
  project,
  copy,
}: {
  project: Project;
  copy: PropertyEditorCopy;
}) {
  const state = usePropertyEdit(copy, project.updatedAt);
  const l = (key: string) => editorLabel(copy, key);
  const field =
    'mt-4 block w-full rounded-md border border-border-line bg-surface-paper px-12 py-12';
  return (
    <form
      className="mt-24 grid gap-16 stitch-panel p-24 md:grid-cols-2"
      onInput={state.changed}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void state.save(`/api/ops/projects/${project.id}/facts`, 'PATCH', {
          ...Object.fromEntries(
            ['name', 'brand', 'address', 'city', 'district', 'projectType'].map((name) => [
              name,
              String(data.get(name) || '').trim() ||
                (name === 'name' || name === 'address' ? '' : null),
            ])
          ),
          totalUnits: data.get('totalUnits') ? Number(data.get('totalUnits')) : null,
        });
      }}
    >
      {(
        [
          ['name', 'name'],
          ['brand', 'brand'],
          ['address', 'address'],
          ['city', 'city'],
          ['district', 'district'],
          ['projectType', 'project_type'],
        ] as const
      ).map(([name, label]) => (
        <label key={name} className="text-small">
          {l(label)}
          <input
            required={name === 'name' || name === 'address'}
            className={field}
            name={name}
            defaultValue={project[name] || ''}
          />
        </label>
      ))}
      <label className="text-small">
        {l('units')}
        <input
          type="number"
          step="1"
          min="0"
          className={field}
          name="totalUnits"
          defaultValue={project.totalUnits ?? ''}
        />
      </label>
      <div className="md:col-span-2">
        <p className="mb-12 text-small text-text-secondary">{l('facilities_hint')}</p>
        <button
          type="submit"
          disabled={state.busy || state.conflict}
          className="rounded-md bg-brand-deep px-24 py-12 font-semibold text-white"
        >
          {l(state.busy ? 'saving' : 'save')}
        </button>
        {state.message && (
          <p role="status" className="mt-8 text-small">
            {state.message}
          </p>
        )}
        {state.conflict && (
          <button
            type="button"
            onClick={state.reload}
            className="mt-12 rounded-md border px-16 py-12"
          >
            {l('reload')}
          </button>
        )}
      </div>
    </form>
  );
}
