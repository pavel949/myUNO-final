import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safe local authentication return', () => {
  it('preserves exact booking context, intent and encoded query values', () => {
    const next = '/book/review?unitId=unit-a&bookingIntent=123&note=two%20words#review';
    expect(safeNextPath(next)).toBe(next);
  });
  it.each([null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example',
    'javascript:alert(1)', '/\n/evil.example', '/\t/evil.example', ' /book/review'])('rejects %s', value => {
    expect(safeNextPath(value)).toBeNull();
  });
});
