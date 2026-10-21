import { expect, it } from 'vitest';
import { unitEditorReturn } from './property-editor-return';
const context = { unitId: 'unit', selfListing: false, mc: true, staff: false, admin: true };
it('returns admin calendar entry to the calendar and preserves an explicit same-unit workspace', () => {
  expect(unitEditorReturn(context)).toBe('/ops/calendar/unit');
  expect(unitEditorReturn({ ...context, requested: '/mc/properties/unit?tab=calendar' })).toBe(
    '/mc/properties/unit?tab=calendar'
  );
});
it.each([
  'https://example.com',
  '//example.com',
  '/mc/properties/other?tab=owner',
  '/mc/properties/unit/extra',
])('rejects unrelated return destination %s', (requested) => {
  expect(unitEditorReturn({ ...context, requested })).toBe('/ops/calendar/unit');
});
it('does not return self-listing or MC-only users to privileged operations', () => {
  expect(unitEditorReturn({ ...context, admin: false, requested: '/ops/calendar/unit' })).toBe(
    '/mc/properties/unit'
  );
  expect(unitEditorReturn({ ...context, selfListing: true })).toBe('/property/listings/unit');
});
