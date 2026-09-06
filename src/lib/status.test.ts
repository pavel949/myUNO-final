import { describe, it, expect } from 'vitest';
import { getStatusVariant, statusClasses, STATUS_VARIANT_CLASSES } from './status';

/**
 * Doc 06 §3.4 asks for one status→colour mapping, so nobody picks a status
 * colour ad hoc. There were three — in Chip, SignalsList and the MC board —
 * each carrying a comment claiming to BE the doc 06 §3.4 mapping, and each
 * disagreeing with the others about neutral.
 */
describe('one status mapping (T-063)', () => {
  it('classifies the statuses the three former maps between them held', () => {
    expect(getStatusVariant('confirmed')).toBe('success');
    expect(getStatusVariant('resolved')).toBe('success');
    expect(getStatusVariant('handed_to_capital')).toBe('success');
    expect(getStatusVariant('requested')).toBe('warning');
    expect(getStatusVariant('open')).toBe('warning');
    expect(getStatusVariant('waiting_reporter')).toBe('warning');
    expect(getStatusVariant('cancelled')).toBe('error');
    expect(getStatusVariant('declined')).toBe('error');
    expect(getStatusVariant('checked_in')).toBe('info');
    expect(getStatusVariant('acknowledged')).toBe('info');
    expect(getStatusVariant('reviewed')).toBe('info');
    expect(getStatusVariant('checked_out')).toBe('neutral');
    expect(getStatusVariant('dismissed')).toBe('neutral');
  });

  it('falls back to neutral rather than throwing on a status nobody has classified', () => {
    // The table grows as enums are added; a screen must not crash over a
    // status that has not been given a colour yet.
    expect(getStatusVariant('a_status_from_the_future')).toBe('neutral');
    expect(statusClasses('a_status_from_the_future')).toBe(STATUS_VARIANT_CLASSES.neutral);
  });

  it('paints only state tokens, never a raw palette colour', () => {
    for (const classes of Object.values(STATUS_VARIANT_CLASSES)) {
      expect(classes).not.toMatch(/\b(bg|text)-(gray|red|green|blue|yellow|amber)-\d/);
      expect(classes).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it('resolves a status to classes in one step', () => {
    expect(statusClasses('confirmed')).toBe(STATUS_VARIANT_CLASSES.success);
  });
});
