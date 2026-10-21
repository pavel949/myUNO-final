/** Shared by canonical writers, including callers outside the HTTP forms. */
export class PropertyEditConflict extends Error {
  constructor() {
    super('property_edit_conflict');
  }
}
export function editVersion(value: unknown): Date | undefined {
  if (value === undefined) return undefined; // Existing non-editor commands remain compatible.
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Invalid edit version');
  return new Date(value);
}
export function requiredText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error(`Invalid ${field}`);
  return value.trim();
}
export function physicalNumber(
  value: unknown,
  field: string,
  minimum: number,
  integer = true
): void {
  const maximum = integer ? 2147483647 : 99999999.99;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer
      ? !Number.isSafeInteger(value)
      : Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)
  )
    throw new Error(`Invalid ${field}`);
}
export function validatePhysicalFacts(input: Record<string, unknown>): void {
  for (const field of ['name', 'addressSupplement'])
    if (input[field] !== undefined) input[field] = requiredText(input[field], field);
  for (const field of ['bedrooms', 'bathrooms', 'maxGuests'])
    if (input[field] !== undefined)
      physicalNumber(input[field], field, field === 'maxGuests' ? 1 : 0);
  for (const field of [
    'sizeSqm',
    'usableAreaSqm',
    'grossAreaSqm',
    'outdoorAreaSqm',
    'plotAreaSqm',
  ]) {
    if (input[field] !== undefined && input[field] !== null)
      physicalNumber(input[field], field, 0, field === 'sizeSqm');
  }
  if (
    input.floor !== undefined &&
    input.floor !== null &&
    (typeof input.floor !== 'string' || input.floor.length > 200)
  )
    throw new Error('Invalid floor');
}
