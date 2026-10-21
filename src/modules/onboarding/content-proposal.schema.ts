import { getLocaleFallbackChain } from '@/modules/content/types';

/**
 * The complete, content-only proposal boundary. Authorization, target binding,
 * baseline snapshots, media ownership and publication belong to the server.
 * Never spread an unparsed request into persistence writes.
 */
export type ContentScope = 'unit' | 'project';
export type ContentLocale = 'ru' | 'en' | 'th' | 'zh';
export type ContentProjectType = 'resort' | 'condominium' | 'villa_estate' | 'standalone';

export type UnitContentFacts = {
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  grossAreaSqm: number | null;
  floor: string | null;
  addressSupplement: string;
  amenityKeys: string[];
};

export type ProjectContentFacts = {
  name: string;
  brand: string | null;
  address: string;
  city: string | null;
  district: string | null;
  projectType: ContentProjectType | null;
  totalUnits: number | null;
};

export type ContentFacts = UnitContentFacts | ProjectContentFacts;
export type ContentDescription = { locale: ContentLocale; value: string };
/** Descriptive changes only. Omitting an amenity never deletes or replaces it. */
export type ContentAmenityHours = { mode: 'keep' } | { mode: 'clear' } | {
  mode: 'daily'; open: string; close: string; timezone: string | null;
};
export type ContentAmenityStaffHours = { mode: 'keep' } | { mode: 'clear' } | { mode: 'range'; open: string; close: string; timezone?: string | null };
export type ContentAmenityRules = { mode: 'keep' } | { mode: 'replace'; lines: string[] };
export type ContentAmenity = {
  id: string | null;
  locale: ContentLocale;
  name: string;
  shortDescription: string | null;
  description: string | null;
  locationLabel: string | null;
  accessInstructions: string | null;
  openingHours: ContentAmenityHours;
  staffHours?: ContentAmenityStaffHours;
  rules: ContentAmenityRules;
};
export type ContentAmenityTextField = 'name' | 'shortDescription' | 'description' | 'accessInstructions';
export const CONTENT_AMENITY_TEXT_FIELDS: readonly ContentAmenityTextField[] = ['name', 'shortDescription', 'description', 'accessInstructions'];
export type ContentAmenitySnapshot = Omit<ContentAmenity, 'id' | 'locale' | 'openingHours' | 'staffHours' | 'rules'> & {
  id: string; openingHours: unknown; rules: unknown;
  translations?: Partial<Record<ContentLocale, Partial<Record<ContentAmenityTextField, string>>>>;
};
/** Matches the public content reader, including empty/needs_review fallbacks. */
export function contentAmenityText(amenity: ContentAmenitySnapshot, locale: ContentLocale, field: ContentAmenityTextField): string | null {
  for (const language of getLocaleFallbackChain(locale)) {
    const value = amenity.translations?.[language]?.[field];
    if (value) return value;
  }
  return amenity[field];
}
/** Parsing trims text; an auto-filled legacy whitespace difference is not authorship. */
export function contentAmenityTextChanged(before: ContentAmenitySnapshot, after: ContentAmenity, field: ContentAmenityTextField): boolean {
  const value = contentAmenityText(before, after.locale, field);
  const proposed = after[field];
  return (proposed === null ? null : proposed.trim()) !== (value === null ? null : value.trim());
}
/** Access and staff schedules share one canonical JSON value without replacing custom keys. */
export function contentAmenityHoursValue(previous: unknown, opening: ContentAmenityHours,
  staff: ContentAmenityStaffHours = { mode: 'keep' }): unknown {
  if (opening.mode === 'keep' && staff.mode === 'keep') return previous;
  const isRecord = previous !== null && typeof previous === 'object' && !Array.isArray(previous);
  if (previous != null && !isRecord && opening.mode !== 'clear') throw new ContentProposalValidationError();
  const old = isRecord ? previous as Record<string, unknown> : {};
  const result: Record<string, unknown> = opening.mode === 'clear' ? {} : { ...old };
  if (opening.mode === 'clear' && (old.staffContact !== undefined || staff.mode === 'range')) {
    if (old.staffContact !== undefined) result.staffContact = old.staffContact;
    if (old.timezone !== undefined) result.timezone = old.timezone;
  }
  if (opening.mode === 'daily') {
    result.daily = [[opening.open, opening.close]];
    if (opening.timezone === null) delete result.timezone;
    else result.timezone = opening.timezone;
  }
  if (staff.mode === 'range') {
    result.staffContact = [[staff.open, staff.close]];
    if (Object.prototype.hasOwnProperty.call(staff, 'timezone')) {
      if (opening.mode === 'daily' && staff.timezone !== opening.timezone) throw new ContentProposalValidationError();
      if (staff.timezone === null) delete result.timezone;
      else result.timezone = staff.timezone;
    }
  }
  if (staff.mode === 'clear') delete result.staffContact;
  if (Object.keys(result).every(key => key === 'timezone')) return null;
  return result;
}
export type ContentGallery = { mediaIds: string[]; coverMediaId: string | null };
export type ContentProposal<Scope extends ContentScope = ContentScope> = {
  facts: Scope extends 'unit' ? UnitContentFacts : ProjectContentFacts;
  description: ContentDescription | null;
  gallery: ContentGallery;
  // Optional for compatibility with saved v1 proposals; project scope only.
  amenities?: ContentAmenity[];
};

/** Safe to return as name/message. No submitted keys, values or exception details. */
export class ContentProposalValidationError extends Error {
  constructor() {
    super('Invalid content proposal.');
    this.name = 'ContentProposalValidationError';
  }

  toJSON(): { name: string; message: string } {
    return { name: this.name, message: this.message };
  }
}

const ROOT_KEYS = ['facts', 'description', 'gallery'] as const;
export const UNIT_FACT_KEYS = Object.freeze([
  'name', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'grossAreaSqm', 'floor',
  'addressSupplement', 'amenityKeys',
] as const);
export const PROJECT_FACT_KEYS = Object.freeze([
  'name', 'brand', 'address', 'city', 'district', 'projectType',
  'totalUnits',
] as const);
const LOCALES: readonly string[] = ['ru', 'en', 'th', 'zh'];
const PROJECT_TYPES: readonly string[] = ['resort', 'condominium', 'villa_estate', 'standalone'];
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

function invalid(): never {
  throw new ContentProposalValidationError();
}

/**
 * Only JSON-shaped own data properties are accepted. Reflect.ownKeys also
 * catches hidden/symbol keys; descriptor reads never invoke supplied getters.
 * Null-prototype records are safe inputs, but output is always freshly built.
 */
function record<const Keys extends readonly string[]>(
  value: unknown,
  expectedKeys: Keys,
): { [Key in Keys[number]]: unknown } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length) invalid();
  const result = Object.create(null) as { [Key in Keys[number]]: unknown };
  for (const key of keys) {
    if (typeof key !== 'string' || !expectedKeys.includes(key)) invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalid();
    result[key as Keys[number]] = descriptor.value;
  }
  return result;
}

function boundedString(value: unknown, maxLength: number, required = false): string {
  if (typeof value !== 'string') invalid();
  const normalized = value.trim();
  if (normalized.length > maxLength || (required && normalized.length === 0)) invalid();
  return normalized;
}

function nullableString(value: unknown, maxLength: number): string | null {
  return value === null ? null : boundedString(value, maxLength);
}

function nonnegativeInteger(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maximum) invalid();
  // Canonicalize negative zero without turning unknown/zero capacity into null.
  return value === 0 ? 0 : value;
}

function nullableInteger(value: unknown, maximum: number): number | null {
  return value === null ? null : nonnegativeInteger(value, maximum);
}

function nullableArea(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      value > 99_999_999.99 || Number(value.toFixed(2)) !== value) invalid();
  return value === 0 ? 0 : value;
}

function arrayValues(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid();
  if (value.length > maximum) invalid();
  // Dense arrays with exactly their indices plus length. Reject extra props,
  // accessors, custom prototypes and holes instead of silently discarding them.
  if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalid();
    result.push(descriptor.value);
  }
  return result;
}

function uniqueStrings(value: unknown, maximum: number, parse: (item: unknown) => string): string[] {
  const result = arrayValues(value, maximum).map(parse);
  if (new Set(result).size !== result.length) invalid();
  return result;
}

function stringList(value: unknown): string[] {
  return uniqueStrings(value, 100, item => boundedString(item, 100, true));
}

function mediaId(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_UUID.test(value)) invalid();
  return value;
}

function unitFacts(value: unknown): UnitContentFacts {
  const facts = record(value, UNIT_FACT_KEYS);
  return {
    name: boundedString(facts.name, 160, true),
    bedrooms: nonnegativeInteger(facts.bedrooms, 1000),
    bathrooms: nonnegativeInteger(facts.bathrooms, 1000),
    maxGuests: nonnegativeInteger(facts.maxGuests, 1000),
    sizeSqm: nullableInteger(facts.sizeSqm, 1_000_000),
    grossAreaSqm: nullableArea(facts.grossAreaSqm),
    floor: nullableString(facts.floor, 40),
    addressSupplement: boundedString(facts.addressSupplement, 500),
    amenityKeys: stringList(facts.amenityKeys),
  };
}

function projectFacts(value: unknown): ProjectContentFacts {
  const facts = record(value, PROJECT_FACT_KEYS);
  if (facts.projectType !== null &&
      (typeof facts.projectType !== 'string' || !PROJECT_TYPES.includes(facts.projectType))) invalid();
  return {
    name: boundedString(facts.name, 160, true),
    brand: nullableString(facts.brand, 160),
    address: boundedString(facts.address, 500, true),
    city: nullableString(facts.city, 160),
    district: nullableString(facts.district, 160),
    projectType: facts.projectType as ContentProjectType | null,
    totalUnits: nullableInteger(facts.totalUnits, 1_000_000),
  };
}

function description(value: unknown): ContentDescription | null {
  if (value === null) return null;
  const fields = record(value, ['locale', 'value']);
  if (typeof fields.locale !== 'string' || !LOCALES.includes(fields.locale)) invalid();
  return {
    locale: fields.locale as ContentLocale,
    value: boundedString(fields.value, 3000, true),
  };
}

function gallery(value: unknown): ContentGallery {
  const fields = record(value, ['mediaIds', 'coverMediaId']);
  const mediaIds = uniqueStrings(fields.mediaIds, 200, mediaId);
  const coverMediaId = fields.coverMediaId === null ? null : mediaId(fields.coverMediaId);
  if (coverMediaId !== null && !mediaIds.includes(coverMediaId)) invalid();
  return { mediaIds, coverMediaId };
}

const AMENITY_KEYS = ['id', 'locale', 'name', 'shortDescription', 'description', 'locationLabel',
  'accessInstructions', 'openingHours', 'rules'] as const;
const AMENITY_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function amenityHours(value: unknown): ContentAmenityHours {
  // Read the mode without invoking accessors, then validate the complete shape.
  const mode = value !== null && typeof value === 'object'
    ? Object.getOwnPropertyDescriptor(value, 'mode')?.value : undefined;
  if (mode === 'keep' || mode === 'clear') {
    record(value, ['mode']);
    return { mode };
  }
  const fields = record(value, ['mode', 'open', 'close', 'timezone']);
  if (fields.mode !== 'daily' || typeof fields.open !== 'string' || typeof fields.close !== 'string' ||
      !AMENITY_TIME.test(fields.open) || !(AMENITY_TIME.test(fields.close) || fields.close === '24:00') ||
      fields.open === fields.close) invalid();
  const timezone = fields.timezone === null ? null : boundedString(fields.timezone, 100, true);
  if (timezone !== null) {
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { invalid(); }
  }
  return { mode: 'daily', open: fields.open, close: fields.close, timezone };
}
function amenityStaffHours(value: unknown): ContentAmenityStaffHours {
  const mode = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'mode')?.value : undefined;
  if (mode === 'keep' || mode === 'clear') { record(value, ['mode']); return { mode }; }
  const hasTimezone = value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'timezone');
  const fields = record(value, hasTimezone ? ['mode', 'open', 'close', 'timezone'] : ['mode', 'open', 'close']);
  if (fields.mode !== 'range' || typeof fields.open !== 'string' || typeof fields.close !== 'string' ||
      !AMENITY_TIME.test(fields.open) || !(AMENITY_TIME.test(fields.close) || fields.close === '24:00') || fields.open === fields.close) invalid();
  let timezone: string | null = null;
  if (hasTimezone) {
    timezone = fields.timezone === null ? null : boundedString(fields.timezone, 100, true);
    if (timezone !== null) { try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { invalid(); } }
  }
  return { mode: 'range', open: fields.open, close: fields.close, ...(hasTimezone ? { timezone } : {}) };
}
function amenityRules(value: unknown): ContentAmenityRules {
  const mode = value !== null && typeof value === 'object'
    ? Object.getOwnPropertyDescriptor(value, 'mode')?.value : undefined;
  if (mode === 'keep') { record(value, ['mode']); return { mode }; }
  const fields = record(value, ['mode', 'lines']);
  if (fields.mode !== 'replace') invalid();
  return { mode: 'replace', lines: arrayValues(fields.lines, 50).map(line => boundedString(line, 500, true)) };
}
function amenities(value: unknown): ContentAmenity[] {
  const result = arrayValues(value, 100).map(item => {
    const hasStaffHours = item !== null && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'staffHours');
    const fields = record(item, hasStaffHours ? [...AMENITY_KEYS, 'staffHours'] : AMENITY_KEYS);
    if (typeof fields.locale !== 'string' || !LOCALES.includes(fields.locale)) invalid();
    return {
      id: fields.id === null ? null : parseTargetId(fields.id),
      locale: fields.locale as ContentLocale,
      name: boundedString(fields.name, 160, true),
      shortDescription: nullableString(fields.shortDescription, 500),
      description: nullableString(fields.description, 12000),
      locationLabel: nullableString(fields.locationLabel, 500),
      accessInstructions: nullableString(fields.accessInstructions, 4000),
      openingHours: amenityHours(fields.openingHours), rules: amenityRules(fields.rules),
      ...(hasStaffHours ? { staffHours: amenityStaffHours(fields.staffHours) } : {}),
    };
  });
  const ids = result.flatMap(item => item.id === null ? [] : [item.id]);
  if (new Set(ids).size !== ids.length) invalid();
  return result;
}

export function parseScope(value: unknown): ContentScope {
  if (value !== 'unit' && value !== 'project') invalid();
  return value;
}

/** Keep route identifiers exact; whitespace, URLs and path syntax are invalid. */
export function parseTargetId(value: unknown): string {
  if (typeof value !== 'string' || !TARGET_ID.test(value)) invalid();
  return value;
}

export function parseContentProposal<Scope extends ContentScope>(
  scope: Scope,
  value: unknown,
): ContentProposal<Scope> {
  try {
    const parsedScope = parseScope(scope);
    const hasAmenities = value !== null && typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'amenities');
    if (hasAmenities && parsedScope !== 'project') invalid();
    const fields = record(value, hasAmenities ? [...ROOT_KEYS, 'amenities'] : ROOT_KEYS);
    return {
      facts: parsedScope === 'unit' ? unitFacts(fields.facts) : projectFacts(fields.facts),
      description: description(fields.description),
      gallery: gallery(fields.gallery),
      ...(hasAmenities ? { amenities: amenities(fields.amenities) } : {}),
    } as ContentProposal<Scope>;
  } catch {
    // A malformed Proxy can throw from reflection. Never leak its arbitrary
    // exception/message (or submitted values) across this validation boundary.
    throw new ContentProposalValidationError();
  }
}
