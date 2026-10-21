import { describe, expect, it } from 'vitest';
import { resolveUnitMarketingTitleKey } from './unit-marketing-title';

describe('canonical unit marketing-title key', () => {
  it.each(['unit.new.description', 'property_content.proposal.uuid.description', null])('keeps an explicit original title when description becomes %s', descriptionKey => {
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey: 'legacy.shared.title', descriptionKey })).toBe('legacy.shared.title');
  });
  it('does not consult or copy translations, including a title created later', () => {
    const unit = { marketingTitleKey: 'unit.original.title', descriptionKey: 'unit.changed.description' };
    const translations = new Map<string, string>();
    expect(translations.get(resolveUnitMarketingTitleKey(unit)!)).toBeUndefined();
    translations.set('unit.original.title', 'Added after description approval');
    expect(translations.get(resolveUnitMarketingTitleKey(unit)!)).toBe('Added after description approval');
    translations.set('unit.original.title', 'Edited independently');
    expect(translations.get(resolveUnitMarketingTitleKey(unit)!)).toBe('Edited independently');
    expect(translations.has('unit.changed.title')).toBe(false);
  });
  it.each([null, undefined])('retains suffix-only derivation for legacy pointer %s', marketingTitleKey => {
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey, descriptionKey: 'unit.original.description' })).toBe('unit.original.title');
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey, descriptionKey: 'legacy.shared_copy' })).toBe('legacy.shared_copy');
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey, descriptionKey: 'unit.description.more' })).toBe('unit.description.more');
  });
  it.each([null, undefined, ''])('returns no derived title without a description %s', descriptionKey => {
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey: null, descriptionKey })).toBeNull();
  });
  it('uses nullish semantics even for an explicit empty string without inferring another key', () => {
    expect(resolveUnitMarketingTitleKey({ marketingTitleKey: '', descriptionKey: 'unit.new.description' })).toBe('');
  });
  it('does not mutate the pointer or description', () => {
    const unit = Object.freeze({ marketingTitleKey: null, descriptionKey: 'unit.original.description' });
    expect(resolveUnitMarketingTitleKey(unit)).toBe('unit.original.title');
    expect(unit).toEqual({ marketingTitleKey: null, descriptionKey: 'unit.original.description' });
  });
});
