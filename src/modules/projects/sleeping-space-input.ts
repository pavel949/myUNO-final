/** Documentary bed types: a generic double must never be promoted to king/queen. */
export const SLEEPING_BED_TYPES = ['double', 'king', 'queen', 'single', 'sofa_bed'] as const;
export type SleepingBedType = typeof SLEEPING_BED_TYPES[number];
export interface ValidatedSleepingSpace {
  spaceType: string;
  name: string | null;
  sortOrder: number;
  beds: Array<{ bedType: SleepingBedType; count: number }>;
  requestId?: string;
}
function integer(value: unknown, field: string, minimum: number) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') {
    throw new Error(`${field} must be a whole number`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > 2147483647) {
    throw new Error(`${field} must be a whole number of at least ${minimum}`);
  }
  return number;
}
export function validateSleepingSpace(value: unknown): ValidatedSleepingSpace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid sleeping space');
  const body = value as Record<string, unknown>;
  const spaceType = body.spaceType || 'bedroom';
  if (spaceType !== 'bedroom' && spaceType !== 'living_room') throw new Error('Invalid sleeping space type');
  if (body.name != null && typeof body.name !== 'string') throw new Error('Invalid sleeping space name');
  const name = typeof body.name === 'string' ? body.name.trim() || null : null;
  if (name && name.length > 200) throw new Error('Sleeping space name is too long');
  const sortOrder = integer(body.sortOrder ?? 0, 'Room order', 0);
  if (!Array.isArray(body.beds) || body.beds.length === 0 || body.beds.length > 20) {
    throw new Error('Add at least one supported bed type');
  }
  const seen = new Set<string>();
  const beds = body.beds.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid bed');
    const bed = entry as Record<string, unknown>;
    if (typeof bed.bedType !== 'string' || !SLEEPING_BED_TYPES.includes(bed.bedType as SleepingBedType)) {
      throw new Error('Invalid bed type');
    }
    if (seen.has(bed.bedType)) throw new Error('Combine repeated bed types into one count');
    seen.add(bed.bedType);
    return { bedType: bed.bedType as SleepingBedType, count: integer(bed.count, 'Bed count', 1) };
  }).sort((a, b) => a.bedType.localeCompare(b.bedType));
  const requestId = body.requestId;
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))) {
    throw new Error('Invalid sleeping-space request ID');
  }
  return { spaceType, name, sortOrder, beds, ...(requestId !== undefined ? { requestId: requestId as string } : {}) };
}
