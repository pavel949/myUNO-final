/** Descriptive intake only. Authority/provenance is never accepted from a client. */
export type EmployeeCreationKind = 'unit' | 'complex';
export type EmployeeCreationStatus = 'draft' | 'submitted';
export type EmployeeCreationDraft = {
  description: string; descriptionLocale: 'en' | 'ru' | 'th' | 'zh' | null;
  proposedProject?: string; projectAddress?: string; projectType?: string; areaId?: string | null;
  latitude?: number | null; longitude?: number | null; projectPhotos?: string[];
  existingUnitId?: string | null; unitName?: string; unitType?: string;
  bedrooms?: number | null; bathrooms?: number | null; maxGuests?: number | null;
  sizeSqm?: number | null; floor?: string; photos?: string[];
};
export class EmployeeCreationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'EmployeeCreationError'; }
}
export function creationInvalid(message = 'Invalid property creation request.'): never { throw new EmployeeCreationError(400, message); }
export function creationObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return creationInvalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return creationInvalid();
  return value as Record<string, unknown>;
}
export function creationExact(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  const data = creationObject(value);
  if (required.some(key => !Object.prototype.hasOwnProperty.call(data, key)) ||
    Object.keys(data).some(key => !required.includes(key) && !optional.includes(key))) return creationInvalid();
  return data;
}
export function creationId(value: unknown): string {
  // Canonical inventory also has pre-UUID seeded IDs.
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/.test(value)) return creationInvalid();
  return value;
}
export function creationRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return creationInvalid();
  return value.toLowerCase();
}
export function creationKind(value: unknown): EmployeeCreationKind {
  if (value !== 'unit' && value !== 'complex') return creationInvalid();
  return value;
}
export function creationStatus(value: unknown): EmployeeCreationStatus {
  if (value !== 'draft' && value !== 'submitted') return creationInvalid();
  return value;
}
export function creationRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) return creationInvalid();
  return value as number;
}
const COMMON = ['description', 'descriptionLocale'];
export const EMPLOYEE_UNIT_FIELDS = ['existingUnitId', 'unitName', 'unitType', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'floor', 'photos'];
export const EMPLOYEE_COMPLEX_FIELDS = ['proposedProject', 'projectAddress', 'projectType', 'areaId', 'latitude', 'longitude', 'projectPhotos'];
const text = (value: unknown, max: number) => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) return creationInvalid();
  return value.trim();
};
const idOrNull = (value: unknown) => value == null || value === '' ? null : creationId(value);
const numberOrNull = (value: unknown, min: number, max: number, integer = false) => {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) return creationInvalid();
  return value;
};
function photos(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return creationInvalid();
  const ids = value.map(creationId);
  if (new Set(ids).size !== ids.length) return creationInvalid();
  return ids;
}
function choice(value: unknown, values: readonly string[], fallback: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !values.includes(value)) return creationInvalid();
  return value;
}
export function parseEmployeeCreationDraft(kind: EmployeeCreationKind, value: unknown, status: EmployeeCreationStatus): EmployeeCreationDraft {
  const data = creationExact(value, [], [...COMMON, ...(kind === 'unit' ? EMPLOYEE_UNIT_FIELDS : EMPLOYEE_COMPLEX_FIELDS)]);
  const description = text(data.description, 3000);
  const descriptionLocale = data.descriptionLocale == null ? null : choice(data.descriptionLocale, ['en', 'ru', 'th', 'zh'], 'en') as EmployeeCreationDraft['descriptionLocale'];
  if (status === 'submitted' && description && !descriptionLocale) return creationInvalid('Choose the description language.');
  if (kind === 'unit') {
    const draft = { description, descriptionLocale, existingUnitId: idOrNull(data.existingUnitId), unitName: text(data.unitName, 160),
      unitType: choice(data.unitType, ['villa', 'apartment', 'condo', 'house'], 'condo'),
      bedrooms: numberOrNull(data.bedrooms, 0, 100, true), bathrooms: numberOrNull(data.bathrooms, 0, 100, true),
      maxGuests: numberOrNull(data.maxGuests, 1, 500, true), sizeSqm: numberOrNull(data.sizeSqm, 0, 100000, true),
      floor: text(data.floor, 40), photos: photos(data.photos) };
    if (status === 'submitted' && (!draft.unitName || draft.bedrooms === null || draft.bathrooms === null || draft.maxGuests === null)) return creationInvalid('Complete the home name, rooms and capacity.');
    return draft;
  }
  const draft = { description, descriptionLocale, proposedProject: text(data.proposedProject, 160), projectAddress: text(data.projectAddress, 500),
    projectType: choice(data.projectType, ['resort', 'condominium', 'villa_estate', 'standalone'], 'condominium'), areaId: idOrNull(data.areaId),
    latitude: numberOrNull(data.latitude, -90, 90), longitude: numberOrNull(data.longitude, -180, 180), projectPhotos: photos(data.projectPhotos) };
  if (status === 'submitted' && (!draft.proposedProject || !draft.projectAddress || !draft.areaId || draft.latitude === null || draft.longitude === null)) return creationInvalid('Complete the complex name, address, area and map location.');
  return draft;
}
export function parseEmployeeCreationCreate(value: unknown) {
  const data = creationExact(value, ['requestId', 'spaceId', 'kind', 'projectId', 'status', 'draft']);
  const kind = creationKind(data.kind), status = creationStatus(data.status), projectId = idOrNull(data.projectId);
  if ((kind === 'unit' && !projectId) || (kind === 'complex' && projectId)) return creationInvalid('Choose the correct creation scope.');
  return { requestId: creationRequestId(data.requestId), spaceId: creationId(data.spaceId), kind, projectId, status,
    draft: parseEmployeeCreationDraft(kind, data.draft, status) };
}
export function parseEmployeeCreationUpdate(value: unknown) {
  const data = creationExact(value, ['id', 'requestId', 'expectedRevision', 'draft', 'status']);
  return { id: creationId(data.id), requestId: creationRequestId(data.requestId), expectedRevision: creationRevision(data.expectedRevision),
    status: creationStatus(data.status), draft: data.draft };
}

export function hasEmployeeCreationReceipt(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'employeeCreation'));
}
/** Reserved provenance is protected as a whole lifecycle, not an editable JSON
 * subfield. A malformed marker must never fall back to ordinary owner intake. */
export function assertNoEmployeeCreationInput(value: unknown) {
  if (hasEmployeeCreationReceipt(value) || (value && typeof value === 'object' && 'requirements' in value &&
    hasEmployeeCreationReceipt((value as Record<string, unknown>).requirements))) {
    throw new EmployeeCreationError(400, 'Employee creation provenance is server-managed.');
  }
}
