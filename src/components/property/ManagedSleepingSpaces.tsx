'use client';
import { useRef, useState } from 'react';
import { usePropertyEdit } from './usePropertyEdit';
import { editorLabel, type PropertyEditorCopy } from '@/modules/content/property-editor.seed';
import { SLEEPING_BED_TYPES } from '@/modules/projects/sleeping-space-input';
export type EditableSleepingSpace = {
  id: string;
  updatedAt: string;
  spaceType: string;
  name: string | null;
  sortOrder: number;
  beds: Array<{ bedType: string; count: number }>;
};
function RoomForm({
  unitId,
  room,
  copy,
  onAdded,
}: {
  unitId: string;
  room?: EditableSleepingSpace;
  copy: PropertyEditorCopy;
  onAdded?: () => void;
}) {
  const state = usePropertyEdit(copy, room?.updatedAt || '');
  const [bedError, setBedError] = useState(false);
  const requestId = useRef<string>();
  const l = (key: string) => editorLabel(copy, key);
  const path = `/api/admin/units/${unitId}/property-details`;
  return (
    <form
      className="mt-16 rounded-md border border-border-line p-16"
      onInput={state.changed}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const beds = SLEEPING_BED_TYPES.map((bedType) => ({
          bedType,
          count: Number(data.get(bedType)),
        })).filter((bed) => bed.count > 0);
        if (!beds.length) {
          setBedError(true);
          return;
        }
        setBedError(false);
        requestId.current ||= crypto.randomUUID();
        const saved = await state.save(path, 'POST', {
          action: room ? 'update_sleeping_space' : 'sleeping_space',
          spaceId: room?.id,
          requestId: requestId.current,
          spaceType: String(data.get('spaceType')),
          name: String(data.get('name') || ''),
          sortOrder: Number(data.get('sortOrder')),
          beds,
        });
        if (saved && !room) onAdded?.();
      }}
    >
      <fieldset disabled={!room && state.busy} className="min-w-0">
        <label className="block text-small">
          {l('room_type')}
          <select
            className="my-8 block w-full rounded-md border p-12"
            name="spaceType"
            defaultValue={room?.spaceType || 'bedroom'}
          >
            <option value="bedroom">{l('bedroom')}</option>
            <option value="living_room">{l('living_room')}</option>
          </select>
        </label>
        <label className="block text-small">
          {l('room_name')}
          <input
            className="my-8 block w-full rounded-md border p-12"
            name="name"
            maxLength={200}
            defaultValue={room?.name || ''}
          />
        </label>
        <label className="block text-small">
          {l('room_order')}
          <input
            name="sortOrder"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={room?.sortOrder ?? 0}
            className="my-8 block w-full rounded-md border p-12"
          />
        </label>
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
          {SLEEPING_BED_TYPES.map((type) => (
            <label key={type} className="text-small">
              {l(type)}
              <input
                name={type}
                type="number"
                min="0"
                step="1"
                required
                className="my-8 block w-full rounded-md border p-12"
                defaultValue={room?.beds.find((bed) => bed.bedType === type)?.count ?? 0}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-12 flex flex-wrap gap-12">
        <button
          type="submit"
          disabled={state.busy || state.conflict}
          className="rounded-md bg-brand-deep px-16 py-12 text-white disabled:opacity-50"
        >
          {l(state.busy ? 'saving' : 'save')}
        </button>
        {room && (
          <button
            type="button"
            disabled={state.busy || state.conflict}
            className="rounded-md border px-16 py-12"
            onClick={() => {
              if (window.confirm(l('remove_room_confirm')))
                void state.save(path, 'POST', {
                  action: 'delete_sleeping_space',
                  spaceId: room.id,
                });
            }}
          >
            {l('remove')}
          </button>
        )}
      </div>
      {bedError && (
        <p role="alert" className="mt-8 text-small">
          {l('beds_required')}
        </p>
      )}
      {state.message && (
        <p role="status" className="mt-8 text-small">
          {state.message}
        </p>
      )}
      {state.conflict && (
        <button type="button" onClick={state.reload}>
          {l('reload')}
        </button>
      )}
    </form>
  );
}
export default function ManagedSleepingSpaces({
  unitId,
  rooms,
  copy,
}: {
  unitId: string;
  rooms: EditableSleepingSpace[];
  copy: PropertyEditorCopy;
}) {
  const [adding, setAdding] = useState(false);
  const l = (key: string) => editorLabel(copy, key);
  return (
    <section className="mt-24 rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-3">{l('sleeping')}</h2>
      <p className="mt-8 text-small text-text-secondary">{l('sleeping_hint')}</p>
      {!rooms.length && <p className="mt-12">{l('sleeping_empty')}</p>}
      {rooms.map((room) => (
        <RoomForm key={room.id} room={room} unitId={unitId} copy={copy} />
      ))}
      {adding ? (
        <RoomForm unitId={unitId} copy={copy} onAdded={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          className="mt-16 rounded-md border px-16 py-12"
          onClick={() => setAdding(true)}
        >
          {l('add_room')}
        </button>
      )}
    </section>
  );
}
