import { describe, it, expect } from 'vitest';
import { buildOrderTimeline, ORDER_JOURNEY } from './order-timeline';

describe('buildOrderTimeline (SA-4)', () => {
  it('walks the happy path in order', () => {
    const t = buildOrderTimeline('accepted');
    expect(t.terminal).toBeNull();
    expect(t.steps.map((s) => s.key)).toEqual([...ORDER_JOURNEY]);
    expect(t.steps.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(t.steps.map((s) => s.current)).toEqual([false, false, true, false]);
  });

  it('treats closed as fully walked', () => {
    const t = buildOrderTimeline('closed');
    expect(t.steps[3].current).toBe(true);
    expect(t.steps.slice(0, 3).every((s) => s.done)).toBe(true);
  });

  it('reports terminal branches without faking progress', () => {
    for (const status of ['cancelled', 'declined', 'expired', 'failed']) {
      const t = buildOrderTimeline(status);
      expect(t.terminal).toBe(status);
      expect(t.steps.every((s) => !s.done && !s.current)).toBe(true);
    }
  });
});
