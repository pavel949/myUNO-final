import { describe, expect, it } from 'vitest';
import { allDestinations, getDestination } from './index';

describe('destination configuration', () => {
  it('uses Phuket as the current destination without leaking it into domain services', () => {
    const destination = getDestination('phuket');
    expect(destination.slug).toBe('phuket');
    expect(destination.currency).toBe('THB');
    expect(destination.timezone).toBe('Asia/Bangkok');
    expect(destination.supportedLocales).toContain('ru');
  });

  it('keeps destination selection behind one boundary', () => {
    expect(allDestinations().map((destination) => destination.key)).toContain('phuket');
    expect(getDestination('not-configured').key).toBe('phuket');
  });
});
