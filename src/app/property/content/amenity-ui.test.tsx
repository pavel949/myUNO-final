import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CONTENT_PROPOSAL_EDITOR_DRAFTS, CONTENT_PROPOSAL_EDITOR_KEYS } from '@/modules/content/content-proposal-editor.seed';
import { CONTENT_UI_LABELS } from './UI-labels';
import { contentAmenityText } from '@/modules/onboarding/content-proposal.schema';
import { AmenityEditor, AmenityComparison, amenityDraft, amenityPayload, existingAmenity, newAmenity, projectAmenityText, readAmenitySnapshots } from './amenity-ui';

const snapshot = {
  id: 'facility-1', name: 'Pool fallback', shortDescription: null, description: 'Full description',
  locationLabel: 'Floor 3', accessInstructions: null,
  openingHours: { monday: [['08:00', '12:00'], ['15:00', '20:00']], staffContact: [['09:00', '17:00']], unknownLegacyKey: { retained: true } },
  rules: { safety: { mandatory: ['No diving'] } },
  translations: { en: { name: '' }, ru: { name: 'Бассейн' } },
};

describe('facility editor safe projection and content labels', () => {
  it('distinguishes a legacy absent baseline from an empty current facility list', () => {
    expect(readAmenitySnapshots(undefined)).toBeUndefined();
    expect(readAmenitySnapshots([])).toEqual([]);
  });

  it('keeps original arbitrary persisted hours/rules and translations unchanged', () => {
    const before = structuredClone(snapshot);
    const read = readAmenitySnapshots([snapshot])!;
    expect(read).toEqual([snapshot]);
    const draft = existingAmenity(read[0], 'th');
    expect(draft.name).toBe('Бассейн');
    expect(draft.openingHours).toEqual({ mode: 'keep' });
    expect(draft.rules).toEqual({ mode: 'keep' });
    expect(snapshot).toEqual(before);
    expect(amenityPayload(draft)).not.toHaveProperty('translations');
  });

  it.each([null, {}, [null], [{ ...snapshot, id: '../foreign' }], [{ ...snapshot, name: 7 }], [{ ...snapshot, translations: { en: { name: 7 } } }], [{ ...snapshot, openingHours: undefined, rules: undefined, name: undefined }]])('fails closed on malformed display snapshots: %j', value => {
    expect(() => readAmenitySnapshots(value)).toThrow();
  });

  it('starts a new facility without invented access, rules, hours or timezone', () => {
    expect(amenityPayload(newAmenity('zh'))).toEqual({ id: null, locale: 'zh', name: '', shortDescription: null, description: null, locationLabel: null, accessInstructions: null, openingHours: { mode: 'keep' }, rules: { mode: 'keep' } });
  });

  it('sends only the active language and drops editor-only caches and blank rule lines', () => {
    const draft = amenityDraft({ ...amenityPayload(newAmenity('en')), name: 'Pool', rules: { mode: 'replace', lines: [' Rule one ', '', '  ', 'Rule two'] } });
    draft.textsByLocale.ru = { name: 'Бассейн', shortDescription: null, description: null, accessInstructions: null };
    expect(amenityPayload(draft)).toEqual({ id: null, locale: 'en', name: 'Pool', shortDescription: null, description: null, locationLabel: null, accessInstructions: null, openingHours: { mode: 'keep' }, rules: { mode: 'replace', lines: ['Rule one', 'Rule two'] } });
  });

  it('registers every facility and changed editor label with four nonempty draft locales', () => {
    const keys = Object.keys(CONTENT_UI_LABELS).filter(key => key.startsWith('property.content.amenities.'));
    expect(keys.length).toBeGreaterThan(35);
    for (const key of [...keys, 'property.content.intro', 'property.content.validation', 'property.content.refresh_confirm']) {
      const rows = CONTENT_PROPOSAL_EDITOR_KEYS.filter(row => row.key === key);
      expect(rows).toHaveLength(1);
      expect(rows[0].en).toBe(CONTENT_UI_LABELS[key]);
      for (const locale of ['en', 'ru', 'th', 'zh'] as const) {
        expect(rows[0][locale]?.trim()).toBeTruthy();
        expect(CONTENT_PROPOSAL_EDITOR_DRAFTS[key][locale]).toBe(rows[0][locale]);
      }
      expect(rows[0].status).toBe('needs_review');
    }
  });

  it('projects cleared English text through the existing Russian fallback while showing the raw clear', () => {
    const before = { ...snapshot, description: 'Canonical fallback', translations: { en: { description: 'English description' }, ru: { description: 'Русский текст' } } };
    const unchanged = structuredClone(before);
    const after = { ...amenityPayload(existingAmenity(before, 'en')), description: null };
    const projected = projectAmenityText(before, after);
    expect(projected.changedFields).toEqual(['description']);
    expect(projected.projected.description).toBeNull();
    expect(projected.projected.translations).toEqual({ en: { description: '' }, ru: { description: 'Русский текст' } });
    expect(projected.effective.description).toBe('Русский текст');
    expect(before).toEqual(unchanged);
    render(<AmenityComparison before={before} after={after} labels={{}}/>);
    const preview = screen.getByRole('region', { name: CONTENT_UI_LABELS['property.content.amenities.public_preview'] });
    expect(within(preview).getByText('Русский текст')).toBeInTheDocument();
    const raw = screen.getByRole('region', { name: CONTENT_UI_LABELS['property.content.amenities.after'] });
    expect(within(raw).queryByText('Русский текст')).not.toBeInTheDocument();
    const canonical = screen.getByRole('region', { name: CONTENT_UI_LABELS['property.content.amenities.canonical_fallback'] });
    expect(within(canonical).getByText('Canonical fallback')).toBeInTheDocument();
    expect(within(canonical).getByText(CONTENT_UI_LABELS['property.content.amenities.empty'])).toBeInTheDocument();
  });

  it('does not rewrite canonical fields or translations for unchanged autofilled fallbacks, including whitespace', () => {
    const before = { ...snapshot, translations: { en: { name: '' }, ru: { name: '  Бассейн  ' } } };
    const projected = projectAmenityText(before, amenityPayload(existingAmenity(before, 'en')));
    expect(projected.changedFields).toEqual([]);
    expect(projected.projected).toEqual(before);
    expect(projected.projected.name).toBe('Pool fallback');
    render(<AmenityComparison before={before} after={amenityPayload(existingAmenity(before, 'en'))} labels={{}}/>);
    expect(screen.queryByRole('region', { name: CONTENT_UI_LABELS['property.content.amenities.canonical_fallback'] })).not.toBeInTheDocument();
  });


  it('shows a safe preview error for an unpreservable historical schedule instead of crashing or pretending it changed', () => {
    const before = { ...snapshot, openingHours: '07:00–20:00' };
    const after = { ...amenityPayload(existingAmenity(before, 'en')), staffHours: { mode: 'range' as const, open: '09:00', close: '17:00' } };
    render(<AmenityComparison before={before} after={after} labels={{}}/>);
    const raw = screen.getByRole('region', { name: CONTENT_UI_LABELS['property.content.amenities.after'] });
    expect(within(raw).getByText(CONTENT_UI_LABELS['property.content.amenities.hours_preview_error'])).toBeInTheDocument();
    expect(within(raw).queryByText(/09:00–17:00/)).not.toBeInTheDocument();
  });

  it('labels facility guidance as public and warns employees and reviewers against private check-in secrets', () => {
    const draft = existingAmenity(snapshot, 'en');
    const view = render(<AmenityEditor baseline={[snapshot]} entries={[draft]} locale="en" disabled={false} labels={{}} onChange={() => {}}/>);
    const warning = CONTENT_UI_LABELS['property.content.amenities.public_access_hint'];
    expect(screen.getByLabelText('Access instructions')).toHaveAccessibleDescription(warning);
    expect(warning).toMatch(/door codes, safe codes, Wi-Fi passwords/);
    view.unmount();
    render(<AmenityComparison before={snapshot} after={amenityPayload(draft)} labels={{}}/>);
    expect(screen.getByText(warning)).toBeVisible();
  });

  it('warns that preserved translation rows do not guarantee unchanged rendering in other languages', () => {
    const before = { ...snapshot, translations: { ru: { description: 'Old Russian fallback' } } };
    const after = { ...amenityPayload(existingAmenity(before, 'ru')), description: 'New Russian fallback' };
    const preview = projectAmenityText(before, after);
    expect(contentAmenityText(before, 'th', 'description')).toBe('Old Russian fallback');
    expect(contentAmenityText(preview.projected, 'th', 'description')).toBe('New Russian fallback');
    expect(preview.projected.description).toBe('New Russian fallback');
    render(<AmenityComparison before={before} after={after} labels={{}}/>);
    expect(screen.getByText(CONTENT_UI_LABELS['property.content.amenities.public_preview_hint'])).toHaveTextContent('Other languages may display changed fallback text even when their translation rows are preserved.');
  });

});
