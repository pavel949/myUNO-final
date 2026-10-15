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
export type ContentGallery = { mediaIds: string[]; coverMediaId: string | null };
export type ContentProposal<Scope extends ContentScope = ContentScope> = {
  facts: Scope extends 'unit' ? UnitContentFacts : ProjectContentFacts;
  description: ContentDescription | null;
  gallery: ContentGallery;
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
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
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
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
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
    const fields = record(value, ROOT_KEYS);
    return {
      facts: parsedScope === 'unit' ? unitFacts(fields.facts) : projectFacts(fields.facts),
      description: description(fields.description),
      gallery: gallery(fields.gallery),
    } as ContentProposal<Scope>;
  } catch {
    // A malformed Proxy can throw from reflection. Never leak its arbitrary
    // exception/message (or submitted values) across this validation boundary.
    throw new ContentProposalValidationError();
  }
}
