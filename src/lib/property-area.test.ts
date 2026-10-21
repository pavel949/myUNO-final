import { describe, expect, it } from 'vitest';
import { propertyHeadlineArea } from './property-area';
describe('property area headline', () => {
  it('uses gross area without altering internal/legacy facts', () => {
    const unit = { grossAreaSqm: 120.25, sizeSqm: 90, usableAreaSqm: 80.5 };
    expect(propertyHeadlineArea(unit)).toBe(120.25);
    expect(unit).toEqual({ grossAreaSqm: 120.25, sizeSqm: 90, usableAreaSqm: 80.5 });
  });
  it.each([null, undefined])('falls back only when gross area is absent (%s)', (grossAreaSqm) => {
    expect(propertyHeadlineArea({ grossAreaSqm, sizeSqm: 90 })).toBe(90);
  });
  it('does not replace an explicitly zero/invalid gross measurement with another kind of area', () => {
    expect(propertyHeadlineArea({ grossAreaSqm: 0, sizeSqm: 90 })).toBeNull();
    expect(propertyHeadlineArea({ grossAreaSqm: '120.25', sizeSqm: 90 })).toBe(120.25);
    expect(propertyHeadlineArea({ grossAreaSqm: 'NaN', sizeSqm: 90 })).toBeNull();
  });
});
