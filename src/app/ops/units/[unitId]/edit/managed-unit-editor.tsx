'use client';
import { usePropertyEdit } from '@/components/property/usePropertyEdit';
import { editorLabel, type PropertyEditorCopy } from '@/modules/content/property-editor.seed';
type RecordData = {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  floor: string | null;
  addressSupplement: string;
  updatedAt: string;
  usableAreaSqm: number | null;
  grossAreaSqm: number | null;
  outdoorAreaSqm: number | null;
  plotAreaSqm: number | null;
};
export default function ManagedUnitEditor({
  unit,
  copy,
}: {
  unit: RecordData;
  copy: PropertyEditorCopy;
}) {
  const state = usePropertyEdit(copy, unit.updatedAt);
  const l = (key: string) => editorLabel(copy, key);
  const field =
    'mt-4 block w-full rounded-md border border-border-line bg-surface-paper px-12 py-12';
  const counts = [
    ['bedrooms', 'bedrooms', 0],
    ['bathrooms', 'bathrooms', 0],
    ['maxGuests', 'guests', 1],
  ] as const;
  const areas = [
    ['grossAreaSqm', 'gross'],
    ['usableAreaSqm', 'usable'],
    ['outdoorAreaSqm', 'outdoor'],
    ['plotAreaSqm', 'plot'],
    ['sizeSqm', 'size'],
  ] as const;
  return (
    <form
      className="mt-24 grid gap-16 stitch-panel p-24 md:grid-cols-2"
      onInput={state.changed}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void state.save(`/api/admin/units/${unit.id}`, 'PUT', {
          name: String(data.get('name') || '').trim(),
          addressSupplement: String(data.get('addressSupplement') || '').trim(),
          floor: String(data.get('floor') || ''),
          ...Object.fromEntries(counts.map(([name]) => [name, Number(data.get(name))])),
          ...Object.fromEntries(
            areas.map(([name]) => [name, data.get(name) === '' ? null : Number(data.get(name))])
          ),
        });
      }}
    >
      <label className="text-small">
        {l('name')}
        <input required className={field} name="name" defaultValue={unit.name} />
      </label>
      <label className="text-small">
        {l('location')}
        <input
          required
          className={field}
          name="addressSupplement"
          defaultValue={unit.addressSupplement}
        />
      </label>
      <label className="text-small">
        {l('floor')}
        <input className={field} name="floor" defaultValue={unit.floor || ''} />
      </label>
      {counts.map(([name, label, min]) => (
        <label key={name} className="text-small">
          {l(label)}
          <input
            required
            min={min}
            step="1"
            type="number"
            className={field}
            name={name}
            defaultValue={unit[name]}
          />
        </label>
      ))}
      {areas.map(([name, label]) => (
        <label key={name} className="text-small">
          {l(label)}
          <input
            min="0"
            step={name === 'sizeSqm' ? '1' : '0.01'}
            type="number"
            className={field}
            name={name}
            defaultValue={unit[name] ?? ''}
          />
        </label>
      ))}
      <p className="text-small text-text-secondary md:col-span-2">{l('area_hint')}</p>
      <div className="md:col-span-2">
        <p className="mb-12 text-small text-text-secondary">{l('facts_hint')}</p>
        <button
          type="submit"
          disabled={state.busy || state.conflict}
          className="rounded-md bg-brand-deep px-24 py-12 font-semibold text-white disabled:opacity-50"
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
