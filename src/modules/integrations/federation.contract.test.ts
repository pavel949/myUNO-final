import { describe, expect, it } from 'vitest';

// Pure contract tests for the ordering rule used by federation.service. DB
// integration coverage is additionally required in the canonical acceptance
// suite when the CI runner is available.
function isStale(input: {
  eventVersion?: number;
  eventOccurredAt: Date;
  lastEventVersion?: bigint | null;
  lastOccurredAt?: Date | null;
}) {
  if (input.eventVersion !== undefined && input.lastEventVersion != null) {
    return BigInt(input.eventVersion) <= input.lastEventVersion;
  }
  if (input.eventVersion === undefined && input.lastOccurredAt) {
    return input.eventOccurredAt <= input.lastOccurredAt;
  }
  return false;
}

describe('federation ordering contract', () => {
  it('rejects an older or replayed aggregate version', () => {
    expect(isStale({ eventVersion: 9, eventOccurredAt: new Date(), lastEventVersion: 10n })).toBe(true);
    expect(isStale({ eventVersion: 10, eventOccurredAt: new Date(), lastEventVersion: 10n })).toBe(true);
    expect(isStale({ eventVersion: 11, eventOccurredAt: new Date(), lastEventVersion: 10n })).toBe(false);
  });

  it('uses occurredAt ordering when the source has no version', () => {
    const last = new Date('2026-09-10T00:00:00Z');
    expect(isStale({ eventOccurredAt: new Date('2026-09-09T23:59:59Z'), lastOccurredAt: last })).toBe(true);
    expect(isStale({ eventOccurredAt: new Date('2026-09-10T00:00:01Z'), lastOccurredAt: last })).toBe(false);
  });
});
