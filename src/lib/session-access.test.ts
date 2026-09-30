import { describe, expect, it } from 'vitest';
import { mayHoldSession } from './session';

describe('current identity lifecycle limits sessions', () => {
  it('allows only active identities, even when a signed token still exists', () => {
    expect(mayHoldSession('active')).toBe(true);
    for (const state of ['invited', 'blocked', 'merged', 'deletion_requested', 'unknown']) {
      expect(mayHoldSession(state)).toBe(false);
    }
  });
});
