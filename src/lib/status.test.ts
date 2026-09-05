import { describe, it, expect } from 'vitest';
import { getStatusVariant } from './status';

// The single source for doc 06 §3.4 — every consumer (Chip, StatusChip) reads
// through this function so a status color is never chosen ad hoc twice.
describe('getStatusVariant', () => {
  it('maps confirmed/paid/filed/resolved/active/won to success', () => {
    for (const s of ['confirmed', 'paid', 'filed', 'resolved', 'active', 'won']) {
      expect(getStatusVariant(s)).toBe('success');
    }
  });

  it('maps pending_payment/requested/vetting/in_progress/needs_review to warning', () => {
    for (const s of ['pending_payment', 'requested', 'vetting', 'in_progress', 'needs_review']) {
      expect(getStatusVariant(s)).toBe('warning');
    }
  });

  it('maps cancelled/declined/failed/expired/breached/lost to error', () => {
    for (const s of ['cancelled', 'declined', 'failed', 'expired', 'breached', 'lost']) {
      expect(getStatusVariant(s)).toBe('error');
    }
  });

  it('maps draft/completed/closed/not_required to neutral', () => {
    for (const s of ['draft', 'completed', 'closed', 'not_required']) {
      expect(getStatusVariant(s)).toBe('neutral');
    }
  });

  it('maps checked_in/accepted/published to info', () => {
    for (const s of ['checked_in', 'accepted', 'published']) {
      expect(getStatusVariant(s)).toBe('info');
    }
  });

  it('falls back to neutral for an unmapped status rather than throwing', () => {
    expect(getStatusVariant('some_future_enum_value')).toBe('neutral');
  });
});
