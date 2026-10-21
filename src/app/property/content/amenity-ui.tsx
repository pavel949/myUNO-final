'use client';

import { contentAmenityHoursValue, contentAmenityText, contentAmenityTextChanged, parseTargetId, type ContentAmenity, type ContentAmenitySnapshot, type ContentLocale } from '@/modules/onboarding/content-proposal.schema';
import { amenityRecord, amenityUsageLines, singleAmenityHours } from '@/modules/projects/amenity-usage';
import { CONTENT_UI_LABELS } from './UI-labels';

const LOCALES: ContentLocale[] = ['en', 'ru', 'th', 'zh'];
const TEXT_KEYS = ['name', 'shortDescription', 'description', 'accessInstructions'] as const;
type LocalizedText = Pick<ContentAmenity, typeof TEXT_KEYS[number]>;
export type AmenityDraft = ContentAmenity & { textsByLocale: Partial<Record<ContentLocale, LocalizedText>> };
const input = 'mt-4 min-h-[44px] w-full rounded-md border border-border-line bg-surface-paper px-12 py-8 text-body text-text-ink disabled:opacity-60';
const button = 'min-h-[44px] rounded-md border border-border-line px-16 py-8 text-small font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const fieldKeys = ['name', 'shortDescription', 'description', 'locationLabel', 'accessInstructions'] as const;
const limits = { name: 160, shortDescription: 500, description: 12000, locationLabel: 500, accessInstructions: 4000 };
const labeler = (labels: Record<string, string>) => (key: string) => labels[`property.content.amenities.${key}`] || CONTENT_UI_LABELS[`property.content.amenities.${key}`];

/** Read the display snapshot without normalizing or replacing persisted hours/rules. */
export function readAmenitySnapshots(value: unknown): ContentAmenitySnapshot[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('Invalid amenity snapshot.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid amenity snapshot.');
    const row = item as Record<string, unknown>;
    const fields: Record<string, string | null> = {};
    for (const key of fieldKeys) {
      if ((row[key] !== null || key === 'name') && typeof row[key] !== 'string') throw new Error('Invalid amenity snapshot.');
      fields[key] = row[key] as string | null;
    }
    if (!Object.prototype.hasOwnProperty.call(row, 'openingHours') || !Object.prototype.hasOwnProperty.call(row, 'rules')) throw new Error('Invalid amenity snapshot.');
    const translations: ContentAmenitySnapshot['translations'] = {};
    if (row.translations !== undefined) {
      if (!row.translations || typeof row.translations !== 'object' || Array.isArray(row.translations)) throw new Error('Invalid amenity translations.');
      const source = row.translations as Record<string, unknown>;
      for (const locale of LOCALES) if (source[locale] !== undefined) {
        const texts = source[locale];
        if (!texts || typeof texts !== 'object' || Array.isArray(texts)) throw new Error('Invalid amenity translations.');
        translations[locale] = {};
        for (const key of TEXT_KEYS) {
          const content = (texts as Record<string, unknown>)[key];
          if (content !== undefined) {
            if (typeof content !== 'string') throw new Error('Invalid amenity translations.');
            translations[locale]![key] = content;
          }
        }
      }
    }
    return { id: parseTargetId(row.id), ...fields, openingHours: row.openingHours, rules: row.rules, ...(row.translations !== undefined ? { translations } : {}) } as ContentAmenitySnapshot;
  });
}

function localized(value: ContentAmenitySnapshot, locale: ContentLocale): ContentAmenitySnapshot {
  return { ...value, name: contentAmenityText(value, locale, 'name') ?? value.name, shortDescription: contentAmenityText(value, locale, 'shortDescription'), description: contentAmenityText(value, locale, 'description'), accessInstructions: contentAmenityText(value, locale, 'accessInstructions') };
}
function textFields(value: LocalizedText): LocalizedText {
  return { name: value.name, shortDescription: value.shortDescription, description: value.description, accessInstructions: value.accessInstructions };
}
export function amenityDraft(value: ContentAmenity): AmenityDraft {
  return { ...value, textsByLocale: { [value.locale]: textFields(value) } };
}
export function existingAmenity(value: ContentAmenitySnapshot, locale: ContentLocale): AmenityDraft {
  const content = localized(value, locale);
  return amenityDraft({ id: value.id, locale, ...textFields(content), locationLabel: value.locationLabel, openingHours: { mode: 'keep' }, rules: { mode: 'keep' } });
}
export function newAmenity(locale: ContentLocale): AmenityDraft {
  return amenityDraft({ id: null, locale, name: '', shortDescription: null, description: null, locationLabel: null, accessInstructions: null, openingHours: { mode: 'keep' }, rules: { mode: 'keep' } });
}
export function amenityPayload(value: AmenityDraft): ContentAmenity {
  const { textsByLocale: _texts, ...payload } = value;
  const staffHours = payload.staffHours?.mode === 'range' && payload.openingHours.mode === 'daily'
    ? { mode: 'range' as const, open: payload.staffHours.open, close: payload.staffHours.close } : payload.staffHours;
  return { ...payload, ...(staffHours ? { staffHours } : {}), rules: payload.rules.mode === 'replace' ? { mode: 'replace', lines: payload.rules.lines.map(line => line.trim()).filter(Boolean) } : payload.rules };
}
function simpleDaily(value: unknown): boolean {
  const record = amenityRecord(value);
  return value == null || (Object.keys(record).length > 0 && Object.keys(record).every(key => ['daily', 'staffContact', 'timezone'].includes(key)) && (record.daily == null || singleAmenityHours(record.daily) !== null) && (record.staffContact == null || singleAmenityHours(record.staffContact) !== null));
}
function simpleRules(value: unknown): boolean {
  return value == null || typeof value === 'string' || (Array.isArray(value) && value.every(line => typeof line === 'string'));
}

export function AmenitySnapshotView({ value, labels, hoursKept = false, rulesKept = false, hoursError = false }: {
  value: ContentAmenitySnapshot; labels: Record<string, string>; hoursKept?: boolean; rulesKept?: boolean; hoursError?: boolean;
}) {
  const l = labeler(labels);
  const usageLabels = { daily: l('daily'), staffContact: l('staff_hours'), timezone: l('timezone'), allDay: l('all_day') };
  const hours = amenityUsageLines(value.openingHours, usageLabels);
  const rules = amenityUsageLines(value.rules);
  return <dl className="space-y-12 break-words">
    {fieldKeys.map(key => <div key={key}><dt className="text-small font-semibold">{l(key)}</dt><dd className="whitespace-pre-wrap">{value[key] || l('empty')}</dd></div>)}
    <div><dt className="text-small font-semibold">{l('hours')}{hoursKept ? ` · ${l('unchanged')}` : ''}</dt><dd>{hoursError ? l('hours_preview_error') : hours.length ? <ul>{hours.map((line, index) => <li key={index} className="whitespace-pre-wrap">{line}</li>)}</ul> : l('empty')}</dd></div>
    <div><dt className="text-small font-semibold">{l('rules')}{rulesKept ? ` · ${l('unchanged')}` : ''}</dt><dd>{rules.length ? <ul>{rules.map((line, index) => <li key={index} className="whitespace-pre-wrap">{line}</li>)}</ul> : l('empty')}</dd></div>
  </dl>;
}

/** Mirrors approval: autofilled locale fallbacks never become authored canonical changes. */
export function projectAmenityText(before: ContentAmenitySnapshot | undefined, after: ContentAmenity) {
  const proposed = textFields(after);
  for (const field of TEXT_KEYS) {
    if (proposed[field] !== null) proposed[field] = proposed[field]!.trim();
  }
  const changedFields = TEXT_KEYS.filter(field => !before || contentAmenityTextChanged(before, { ...after, ...proposed }, field));
  const projected: ContentAmenitySnapshot = before
    ? { ...before, translations: { ...before.translations } }
    : { id: '', ...proposed, locationLabel: after.locationLabel, openingHours: null, rules: null, translations: {} };
  for (const field of changedFields) {
    if (field === 'name') projected.name = proposed.name;
    else projected[field] = proposed[field];
    const value = proposed[field] ?? '';
    if (before || value) projected.translations![after.locale] = { ...projected.translations?.[after.locale], [field]: value };
  }
  return { changedFields, projected, effective: localized(projected, after.locale) };
}

export function AmenityComparison({ before, after, labels }: { before?: ContentAmenitySnapshot; after: ContentAmenity; labels: Record<string, string> }) {
  const l = labeler(labels);
  const textPreview = projectAmenityText(before, after);
  let nextHours: unknown = null;
  let hoursError = false;
  try { nextHours = contentAmenityHoursValue(before?.openingHours ?? null, after.openingHours, after.staffHours); }
  catch { hoursError = true; }
  const next: ContentAmenitySnapshot = {
    id: after.id ?? '', ...textFields(after), locationLabel: after.locationLabel,
    openingHours: nextHours,
    rules: after.rules.mode === 'keep' ? before?.rules ?? null : after.rules.lines.filter(line => line.trim()),
  };
  return <div className="space-y-12">
    <p className="text-small text-text-secondary">{l('public_access_hint')}</p>
    <p className="text-small">{l('locale')}: {labels[`property.content.locale.${after.locale}`] || CONTENT_UI_LABELS[`property.content.locale.${after.locale}`]}{after.id === null ? <strong className="ml-8 rounded-md bg-surface-ivory px-8 py-4">{l('new_badge')}</strong> : null}</p>
    <div className="grid gap-16 md:grid-cols-2"><section aria-label={l('before')}><h4 className="mb-8 font-semibold">{l('before')}</h4>{before ? <AmenitySnapshotView value={localized(before, after.locale)} labels={labels}/> : <p>{l(after.id === null ? 'not_created' : 'baseline_missing')}</p>}</section><section aria-label={l('after')}><h4 className="mb-8 font-semibold">{l('after')}</h4><AmenitySnapshotView value={next} labels={labels} hoursKept={after.openingHours.mode === 'keep' && (!after.staffHours || after.staffHours.mode === 'keep')} hoursError={hoursError} rulesKept={after.rules.mode === 'keep'}/></section></div>
    {before || after.id === null ? <>
      <section aria-label={l('public_preview')} className="rounded-md bg-surface-ivory p-12"><h4 className="font-semibold">{l('public_preview')}</h4><p className="mt-4 text-small">{l('public_preview_hint')}</p><dl className="mt-8 grid gap-8 sm:grid-cols-2">{TEXT_KEYS.map(field => <div key={field}><dt className="text-small font-semibold">{l(field)}</dt><dd className="whitespace-pre-wrap break-words">{textPreview.effective[field] || l('empty')}</dd></div>)}</dl></section>
      {textPreview.changedFields.length ? <section aria-label={l('canonical_fallback')}><h4 className="font-semibold">{l('canonical_fallback')}</h4><p className="mt-4 text-small">{l('canonical_fallback_hint')}</p><dl className="mt-8 space-y-12">{textPreview.changedFields.map(field => <div key={field}><dt className="text-small font-semibold">{l(field)}</dt><dd className="mt-4 grid gap-12 sm:grid-cols-2"><div><p className="text-small text-text-secondary">{l('before')}</p><p className="whitespace-pre-wrap break-words">{before?.[field] || l('empty')}</p></div><div><p className="text-small text-text-secondary">{l('after')}</p><p className="whitespace-pre-wrap break-words">{textPreview.projected[field] || l('empty')}</p></div></dd></div>)}</dl></section> : null}
    </> : null}
  </div>;
}

export function AmenityEditor({ baseline, entries, locale, disabled, labels, onChange }: {
  baseline?: ContentAmenitySnapshot[]; entries: AmenityDraft[]; locale: ContentLocale; disabled: boolean;
  labels: Record<string, string>; onChange: (entries: AmenityDraft[]) => void;
}) {
  const l = labeler(labels);
  const change = (index: number, patch: Partial<AmenityDraft>) => onChange(entries.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <fieldset disabled={disabled} className="stitch-panel space-y-16 rounded-lg border border-border-line bg-surface-paper p-20">
    <legend className="px-4 font-display text-heading-3">{l('title')}</legend>
    <p className="text-small text-text-secondary">{l('hint')}</p><p className="text-small text-text-secondary">{l('review_hint')}</p>
    {baseline === undefined ? <p role="status">{l('legacy_baseline')}</p> : <>
      <h3 className="font-semibold">{l('existing')}</h3>
      {baseline.length ? <ul className="space-y-8">{baseline.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-8"><span>{localized(item, locale).name}</span><button type="button" className={button} disabled={disabled || entries.length >= 100 || entries.some(entry => entry.id === item.id)} aria-label={`${l('edit')}: ${localized(item, locale).name}`} onClick={() => onChange([...entries, existingAmenity(item, locale)])}>{l(entries.some(entry => entry.id === item.id) ? 'selected' : 'edit')}</button></li>)}</ul> : <p>{l('none')}</p>}
      <button type="button" className={button} disabled={disabled || entries.length >= 100} onClick={() => onChange([...entries, newAmenity(locale)])}>{l('add')}</button>
    </>}
    {!entries.length ? <p>{l('no_changes')}</p> : entries.map((entry, index) => {
      const before = baseline?.find(item => item.id === entry.id);
      const prefix = `content-amenity-${index}`;
      const dailyAllowed = before?.openingHours == null || (typeof before.openingHours === 'object' && !Array.isArray(before.openingHours));
      const previousTimezone = amenityRecord(before?.openingHours).timezone;
      const staffTimezone = entry.staffHours?.mode === 'range' && entry.staffHours.timezone !== undefined ? entry.staffHours.timezone ?? '' : typeof previousTimezone === 'string' ? previousTimezone : '';
      const staffAllowed = dailyAllowed || entry.openingHours.mode === 'clear';
      const staffRequiresClear = !dailyAllowed && !!entry.staffHours && entry.staffHours.mode !== 'keep';
      const staffAllDay = entry.staffHours?.mode === 'range' && entry.staffHours.open === '00:00' && entry.staffHours.close === '24:00';
      const allDay = entry.openingHours.mode === 'daily' && entry.openingHours.open === '00:00' && entry.openingHours.close === '24:00';
      return <fieldset key={entry.id ?? `new-${index}`} disabled={disabled || baseline === undefined} className="space-y-16 rounded-md border border-border-line p-16">
        <legend className="px-4 font-semibold">{entry.name || l('new_badge')}{entry.id === null && entry.name ? ` · ${l('new_badge')}` : ''}</legend>
        <div><label htmlFor={`${prefix}-locale`}>{l('locale')}</label><select id={`${prefix}-locale`} className={input} value={entry.locale} onChange={event => {
          const nextLocale = event.target.value as ContentLocale;
          const saved = { ...entry.textsByLocale, [entry.locale]: textFields(entry) };
          const next = saved[nextLocale] ?? (before ? textFields(localized(before, nextLocale)) : textFields(newAmenity(nextLocale)));
          change(index, { ...next, locale: nextLocale, textsByLocale: saved });
        }}>{LOCALES.map(language => <option key={language} value={language}>{labels[`property.content.locale.${language}`] || CONTENT_UI_LABELS[`property.content.locale.${language}`]}</option>)}</select><p className="mt-4 text-small text-text-secondary">{l('locale_hint')}</p></div>
        <div className="grid gap-16 sm:grid-cols-2">{fieldKeys.map(key => <div key={key} className={key === 'description' || key === 'accessInstructions' ? 'sm:col-span-2' : ''}><label htmlFor={`${prefix}-${key}`} className="font-semibold">{l(key)}</label>{key === 'description' || key === 'accessInstructions' ? <textarea id={`${prefix}-${key}`} rows={key === 'description' ? 6 : 3} className={input} aria-describedby={key === 'accessInstructions' ? `${prefix}-public-access-hint` : undefined} maxLength={limits[key]} value={entry[key] ?? ''} onChange={event => change(index, { [key]: event.target.value })}/> : <input id={`${prefix}-${key}`} className={input} maxLength={limits[key]} required={key === 'name'} value={entry[key] ?? ''} onChange={event => change(index, { [key]: event.target.value })}/>} {key === 'accessInstructions' ? <p id={`${prefix}-public-access-hint`} className="mt-4 text-small text-text-secondary">{l('public_access_hint')}</p> : null}</div>)}</div>
        <div><label htmlFor={`${prefix}-hours-mode`} className="font-semibold">{l('hours')}</label><select id={`${prefix}-hours-mode`} className={input} value={entry.openingHours.mode} onChange={event => {
          const mode = event.target.value;
          if ((mode === 'daily' && !dailyAllowed) || (mode !== 'clear' && staffRequiresClear)) return;
          const prior = amenityRecord(before?.openingHours); const range = singleAmenityHours(prior.daily);
          change(index, { openingHours: mode === 'daily' ? { mode, open: range?.[0] ?? '', close: range?.[1] ?? '', timezone: typeof prior.timezone === 'string' ? prior.timezone : null } : { mode: mode as 'keep' | 'clear' } });
        }}><option value="keep" disabled={staffRequiresClear}>{l('keep_hours')}</option><option value="daily" disabled={!dailyAllowed}>{l('replace_hours')}</option><option value="clear">{l('clear_hours')}</option></select>
          {!dailyAllowed ? <p className="mt-8 text-small">{l('unsupported_hours')}</p> : !simpleDaily(before?.openingHours) ? <p className="mt-8 text-small">{l('custom_hours')}</p> : null}
          {entry.openingHours.mode === 'daily' ? <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <label className="flex items-center gap-8 sm:col-span-2"><input type="checkbox" checked={allDay} onChange={event => change(index, { openingHours: { ...(entry.openingHours as Extract<ContentAmenity['openingHours'], { mode: 'daily' }>), open: event.target.checked ? '00:00' : '', close: event.target.checked ? '24:00' : '' } })}/>{l('all_day')}</label>
            {(['open', 'close'] as const).map(key => <div key={key}><label htmlFor={`${prefix}-${key}`}>{l(key)}</label><input id={`${prefix}-${key}`} type="time" className={input} disabled={disabled || allDay} required={!allDay} value={entry.openingHours.mode === 'daily' ? entry.openingHours[key] === '24:00' ? '00:00' : entry.openingHours[key] : ''} onChange={event => change(index, { openingHours: { ...(entry.openingHours as Extract<ContentAmenity['openingHours'], { mode: 'daily' }>), [key]: event.target.value } })}/></div>)}
            <div className="sm:col-span-2"><label htmlFor={`${prefix}-timezone`}>{l('timezone')}</label><input id={`${prefix}-timezone`} className={input} maxLength={100} value={entry.openingHours.timezone ?? ''} onChange={event => change(index, { openingHours: { ...(entry.openingHours as Extract<ContentAmenity['openingHours'], { mode: 'daily' }>), timezone: event.target.value.trim() || null } })}/></div>
            <p className="text-small text-text-secondary sm:col-span-2">{l('hours_hint')}</p>
          </div> : null}
        </div>
        <div><label htmlFor={`${prefix}-staff-mode`} className="font-semibold">{l('staff_hours')}</label><select id={`${prefix}-staff-mode`} className={input} value={entry.staffHours?.mode ?? 'keep'} onChange={event => {
          const mode = event.target.value;
          if (mode !== 'keep' && !staffAllowed) return;
          const range = singleAmenityHours(amenityRecord(before?.openingHours).staffContact);
          change(index, { staffHours: mode === 'range' ? { mode, open: range?.[0] ?? '', close: range?.[1] ?? '' } : { mode: mode as 'keep' | 'clear' } });
        }}><option value="keep">{l('keep_staff_hours')}</option><option value="range" disabled={!staffAllowed}>{l('set_staff_hours')}</option><option value="clear" disabled={!staffAllowed}>{l('clear_staff_hours')}</option></select>
          <p className="mt-4 text-small text-text-secondary">{l('staff_hours_hint')}</p>
          {!dailyAllowed ? <p className="mt-8 text-small">{l('unsupported_staff_hours')}</p> : null}
          {entry.staffHours?.mode === 'range' ? <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <label className="flex items-center gap-8 sm:col-span-2"><input type="checkbox" checked={staffAllDay} onChange={event => change(index, { staffHours: { ...(entry.staffHours as Extract<NonNullable<ContentAmenity['staffHours']>, { mode: 'range' }>), mode: 'range', open: event.target.checked ? '00:00' : '', close: event.target.checked ? '24:00' : '' } })}/>{l('staff_all_day')}</label>
            {(['open', 'close'] as const).map(key => <div key={key}><label htmlFor={`${prefix}-staff-${key}`}>{l(`staff_${key}`)}</label><input id={`${prefix}-staff-${key}`} type="time" className={input} disabled={disabled || staffAllDay} required={!staffAllDay} value={entry.staffHours?.mode === 'range' ? entry.staffHours[key] === '24:00' ? '00:00' : entry.staffHours[key] : ''} onChange={event => change(index, { staffHours: { ...(entry.staffHours as Extract<NonNullable<ContentAmenity['staffHours']>, { mode: 'range' }>), [key]: event.target.value } })}/></div>)}
            {entry.openingHours.mode !== 'daily' ? <div className="sm:col-span-2"><label htmlFor={`${prefix}-staff-timezone`}>{l('timezone')}</label><input id={`${prefix}-staff-timezone`} className={input} maxLength={100} aria-describedby={`${prefix}-staff-timezone-hint`} value={staffTimezone} onChange={event => change(index, { staffHours: { ...(entry.staffHours as Extract<NonNullable<ContentAmenity['staffHours']>, { mode: 'range' }>), timezone: event.target.value.trim() || null } })}/><p id={`${prefix}-staff-timezone-hint`} className="mt-4 text-small text-text-secondary">{l('staff_timezone_hint')}</p></div> : null}
          </div> : null}
        </div>
        <div><label htmlFor={`${prefix}-rules-mode`} className="font-semibold">{l('rules')}</label><select id={`${prefix}-rules-mode`} className={input} value={entry.rules.mode} onChange={event => change(index, { rules: event.target.value === 'keep' ? { mode: 'keep' } : { mode: 'replace', lines: simpleRules(before?.rules) ? typeof before?.rules === 'string' ? before.rules.split('\n') : (before?.rules as string[] | null) ?? [] : [] } })}><option value="keep">{l('keep_rules')}</option><option value="replace">{l('replace_rules')}</option></select>
          {!simpleRules(before?.rules) ? <p className="mt-8 text-small">{l('custom_rules')}</p> : null}
          {entry.rules.mode === 'replace' ? <><label htmlFor={`${prefix}-rules-lines`} className="mt-12 block">{l('rules_lines')}</label><textarea id={`${prefix}-rules-lines`} rows={4} className={input} value={entry.rules.lines.join('\n')} onChange={event => change(index, { rules: { mode: 'replace', lines: event.target.value.split('\n') } })}/><p className="mt-4 text-small">{l('rules_hint')}</p></> : null}
        </div>
        <details><summary className="cursor-pointer font-semibold">{l('compare')}</summary><div className="mt-12"><AmenityComparison before={before} after={amenityPayload(entry)} labels={labels}/></div></details>
        <button type="button" className={button} onClick={() => onChange(entries.filter((_, i) => i !== index))}>{l('discard_change')}</button>
      </fieldset>;
    })}
  </fieldset>;
}
