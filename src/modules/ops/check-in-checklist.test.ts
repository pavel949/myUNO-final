import { describe, expect, it } from 'vitest';
import { formatCheckInChecklistNotes } from './check-in-checklist';

describe('formatCheckInChecklistNotes', () => {
  it('formats checklist and notes', () => {
    expect(
      formatCheckInChecklistNotes(['entry', 'kitchen'], 'Minor scuff on door.')
    ).toBe('Checklist: entry, kitchen\nMinor scuff on door.');
  });

  it('handles empty notes', () => {
    expect(formatCheckInChecklistNotes(['bedrooms'], '')).toBe('Checklist: bedrooms');
  });
});
