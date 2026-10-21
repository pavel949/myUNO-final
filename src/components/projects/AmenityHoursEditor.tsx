/* eslint-disable local-rules/no-literal-ui-text */
'use client';
import { useState } from 'react';
import { amenityLinesInput, amenityRecord, hasSimpleAmenityHours, singleAmenityHours } from '@/modules/projects/amenity-usage';

const input = 'mt-4 h-40 w-full rounded-md border border-border-line bg-surface-paper px-12 text-text-ink';
export default function AmenityHoursEditor({ value, timezone, disabled = false }: { value: unknown; timezone: string; disabled?: boolean }) {
  const [mode, setMode] = useState(hasSimpleAmenityHours(value) ? 'daily' : 'custom');
  const record = amenityRecord(value);
  const daily = singleAmenityHours(record.daily);
  const staff = singleAmenityHours(record.staffContact);
  const [allDay, setAllDay] = useState(daily?.[0] === '00:00' && daily?.[1] === '24:00');
  return <fieldset disabled={disabled} className="space-y-12 md:col-span-2">
    <legend className="text-small font-semibold">Opening and access hours</legend>
    <label className="block text-small">Schedule format<select name="hoursMode" value={mode} onChange={event => setMode(event.target.value)} className={input}><option value="daily">Same hours every day</option><option value="custom">Custom schedule / existing format</option></select></label>
    <div className={mode === 'daily' ? 'grid gap-12 md:grid-cols-2' : 'hidden'}>
      <label className="flex items-center gap-8 text-small md:col-span-2"><input type="checkbox" name="hoursOpen24h" checked={allDay} onChange={event => setAllDay(event.target.checked)} />Open / accessible 24 hours</label>
      <label className="text-small">Opens at<input name="hoursOpen" type="time" disabled={allDay} defaultValue={daily?.[0] || ''} className={input}/></label>
      <label className="text-small">Closes at<input name="hoursClose" type="time" disabled={allDay} defaultValue={daily?.[1] === '24:00' ? '00:00' : daily?.[1] || ''} className={input}/></label>
      <p className="text-small text-text-secondary md:col-span-2">Leave unknown hours empty. Staff availability is separate from access hours.</p>
      <label className="text-small">Staff contact from (optional)<input name="staffHoursOpen" type="time" defaultValue={staff?.[0] || ''} className={input}/></label>
      <label className="text-small">Staff contact until (optional)<input name="staffHoursClose" type="time" defaultValue={staff?.[1] === '24:00' ? '00:00' : staff?.[1] || ''} className={input}/></label>
      <label className="text-small md:col-span-2">Time zone<input name="hoursTimezone" defaultValue={typeof record.timezone === 'string' ? record.timezone : timezone} className={input}/></label>
    </div>
    <label className={mode === 'custom' ? 'block text-small' : 'hidden'}>Custom opening hours<textarea name="openingHours" defaultValue={amenityLinesInput(value)} className="mt-4 min-h-96 w-full rounded-md border border-border-line p-12"/><span className="mt-4 block text-text-secondary">Existing schedules are preserved. Use one line per rule, or valid JSON for weekly and split schedules.</span></label>
  </fieldset>;
}
