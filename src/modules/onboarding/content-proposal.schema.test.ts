import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  ContentProposalValidationError,
  parseContentProposal,
  parseScope,
  parseTargetId,
  type ContentProposal,
  type ContentScope,
  type ProjectContentFacts,
  type UnitContentFacts,
} from './content-proposal.schema';

const MEDIA_A = 'a1234567-1234-4123-8123-123456789abc';
const MEDIA_B = 'b1234567-1234-4123-8123-123456789abc';
const unit = (): ContentProposal<'unit'> => ({
  facts: {
    name: 'D201', bedrooms: 2, bathrooms: 1, maxGuests: 0,
    sizeSqm: null, grossAreaSqm: null, floor: null, addressSupplement: '', amenityKeys: [],
  },
  description: null,
  gallery: { mediaIds: [], coverMediaId: null },
});
const project = (): ContentProposal<'project'> => ({
  facts: {
    name: 'Legendary', brand: null, address: '123 Main Road', city: null,
    district: null, projectType: null, totalUnits: null,
  },
  description: null,
  gallery: { mediaIds: [], coverMediaId: null },
});
const proposal = (scope: ContentScope) => scope === 'unit' ? unit() : project();
const parse = (value: unknown) => parseContentProposal('unit', value);
const invalidValues: unknown[] = [undefined, null, [], '', 'value', 0, true, () => ({}), new Date()];
const numericInvalids: unknown[] = [undefined, null, '0', '', false, {}, [], NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER];

describe('complete content-only proposals', () => {
  it('accepts both scopes and infers facts from the supplied scope', () => {
    const parsedUnit = parseContentProposal('unit', unit());
    const parsedProject = parseContentProposal('project', project());
    expect(parsedUnit).toEqual(unit());
    expect(parsedProject).toEqual(project());
    expectTypeOf(parsedUnit.facts).toEqualTypeOf<UnitContentFacts>();
    expectTypeOf(parsedProject.facts).toEqualTypeOf<ProjectContentFacts>();
  });

  it('trims content and returns fresh objects and arrays without mutating inputs', () => {
    const input = unit();
    input.facts.name = '  D201  ';
    input.facts.floor = '  2  ';
    input.facts.addressSupplement = '  Building A  ';
    input.facts.amenityKeys = ['  wifi  ', 'pool'];
    input.description = { locale: 'en', value: '  Текст explicitly tagged en  ' };
    input.gallery = { mediaIds: [MEDIA_B, MEDIA_A], coverMediaId: MEDIA_A };
    const original = structuredClone(input);
    const output = parse(input);
    expect(output).toEqual({
      facts: { ...unit().facts, name: 'D201', floor: '2', addressSupplement: 'Building A', amenityKeys: ['wifi', 'pool'] },
      description: { locale: 'en', value: 'Текст explicitly tagged en' },
      gallery: { mediaIds: [MEDIA_B, MEDIA_A], coverMediaId: MEDIA_A },
    });
    expect(input).toEqual(original);
    expect(output).not.toBe(input);
    expect(output.facts).not.toBe(input.facts);
    expect(output.facts.amenityKeys).not.toBe(input.facts.amenityKeys);
    expect(output.description).not.toBe(input.description);
    expect(output.gallery).not.toBe(input.gallery);
    expect(output.gallery.mediaIds).not.toBe(input.gallery.mediaIds);
  });

  it('normalizes project strings and permits blank optional strings', () => {
    const input = project();
    input.facts = {
      ...input.facts, name: '  Place  ', address: '  Road  ', brand: '  Brand  ',
      city: '  ', district: '  District  ',
    };
    expect(parseContentProposal('project', input).facts).toEqual({
      ...project().facts, name: 'Place', address: 'Road', brand: 'Brand',
      city: '', district: 'District',
    });
  });

  it('preserves unknown zero capacity and nullable fields; normalizes negative zero', () => {
    const input = unit();
    input.facts.maxGuests = -0;
    const output = parse(input);
    expect(output.facts.maxGuests).toBe(0);
    expect(Object.is(output.facts.maxGuests, -0)).toBe(false);
    expect(output.facts.sizeSqm).toBeNull();
    expect(output.facts.floor).toBeNull();
  });

  it.each(['unit', 'project'] as const)('rejects cross-scope facts in %s', scope => {
    const input = proposal(scope);
    input.facts = proposal(scope === 'unit' ? 'project' : 'unit').facts;
    expect(() => parseContentProposal(scope, input)).toThrow(ContentProposalValidationError);
  });

  it.each(invalidValues)('rejects malformed root %s', value => {
    expect(() => parse(value)).toThrow(ContentProposalValidationError);
  });

  it.each(['facts', 'description', 'gallery'])('requires root key %s even when nullable', key => {
    const input = unit() as unknown as Record<string, unknown>;
    delete input[key];
    expect(() => parse(input)).toThrow(ContentProposalValidationError);
  });

  it.each(['unit', 'project'] as const)('requires every %s facts key', scope => {
    for (const key of Object.keys(proposal(scope).facts)) {
      const input = proposal(scope);
      delete (input.facts as unknown as Record<string, unknown>)[key];
      expect(() => parseContentProposal(scope, input), key).toThrow(ContentProposalValidationError);
    }
  });

  it.each(['facts', 'gallery'])('rejects malformed %s objects', key => {
    for (const value of invalidValues) {
      expect(() => parse({ ...unit(), [key]: value })).toThrow(ContentProposalValidationError);
    }
  });

  it.each(['description', 'gallery'] as const)('requires every nested %s key', key => {
    const input = unit();
    input.description = { locale: 'en', value: 'Text' };
    for (const childKey of Object.keys(input[key]!)) {
      const malformed = structuredClone(input);
      delete (malformed[key] as Record<string, unknown>)[childKey];
      expect(() => parse(malformed)).toThrow(ContentProposalValidationError);
    }
  });
});

describe('strict allowlists and hostile objects', () => {
  const forbidden = [
    'id', 'scope', 'targetId', 'ownerId', 'ownerPartyId', 'managerId', 'managerPartyId',
    'projectId', 'status', 'reviewStatus', 'isPublished', 'pricing', 'price', 'currency',
    'commission', 'payoutAccount', 'permissions', 'roles', 'createdBy', 'approvedBy',
    'baselineHash', 'snapshot', 'data', 'unknown', '__proto__', 'constructor', 'prototype', 'facilities',
  ];

  it.each(forbidden)('rejects mass assignment key %s at every object layer', key => {
    for (const scope of ['unit', 'project'] as const) {
      for (const location of ['root', 'facts', 'description', 'gallery'] as const) {
        const input = proposal(scope);
        input.description = { locale: 'en', value: 'Description' };
        const target = location === 'root' ? input : input[location]!;
        Object.defineProperty(target, key, { value: 'secret-payload', enumerable: true });
        expect(() => parseContentProposal(scope, input), `${scope}.${location}`).toThrow(ContentProposalValidationError);
      }
    }
  });

  it('rejects JSON __proto__ without modifying any prototype', () => {
    const input = JSON.parse(JSON.stringify(unit()));
    input.facts = JSON.parse('{"__proto__":{"polluted":true},' + JSON.stringify(input.facts).slice(1));
    expect(() => parse(input)).toThrow(ContentProposalValidationError);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('rejects inherited keys, custom prototypes and class instances', () => {
    const inherited = Object.create(unit());
    expect(() => parse(inherited)).toThrow(ContentProposalValidationError);
    const custom = unit();
    Object.setPrototypeOf(custom.facts, { ownerId: 'someone' });
    expect(() => parse(custom)).toThrow(ContentProposalValidationError);
    class Facts { name = 'Name'; }
    expect(() => parse({ ...unit(), facts: new Facts() })).toThrow(ContentProposalValidationError);
  });

  it('accepts null-prototype records and frozen ordinary inputs', () => {
    const input = unit();
    Object.setPrototypeOf(input, null);
    Object.setPrototypeOf(input.facts, null);
    Object.setPrototypeOf(input.gallery, null);
    Object.freeze(input.facts.amenityKeys);
    Object.freeze(input.facts);
    Object.freeze(input.gallery.mediaIds);
    Object.freeze(input.gallery);
    Object.freeze(input);
    expect(parse(input)).toEqual(unit());
    expect(Object.getPrototypeOf(parse(input))).toBe(Object.prototype);
  });

  it.each(['root', 'facts', 'description', 'gallery'] as const)('rejects hidden/symbol keys on %s', location => {
    for (const key of [Symbol('ownerId'), 'ownerId']) {
      const input = unit();
      input.description = { locale: 'en', value: 'Text' };
      const target = location === 'root' ? input : input[location]!;
      Object.defineProperty(target, key, { value: 'hidden', enumerable: false });
      expect(() => parse(input)).toThrow(ContentProposalValidationError);
    }
  });

  it('rejects getters without invoking them, including on arrays', () => {
    const getter = vi.fn(() => 'secret');
    const input = unit();
    Object.defineProperty(input.facts, 'name', { get: getter, enumerable: true });
    expect(() => parse(input)).toThrow(ContentProposalValidationError);
    const arrayInput = unit();
    arrayInput.facts.amenityKeys = ['wifi'];
    Object.defineProperty(arrayInput.facts.amenityKeys, '0', { get: getter, enumerable: true });
    expect(() => parse(arrayInput)).toThrow(ContentProposalValidationError);
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects non-enumerable expected keys', () => {
    const input = unit();
    Object.defineProperty(input.facts, 'name', { value: 'Name', enumerable: false });
    expect(() => parse(input)).toThrow(ContentProposalValidationError);
  });

  it('converts reflection failures into the same safe error', () => {
    const input = new Proxy({}, { getPrototypeOf() { throw new Error('secret-internal-token'); } });
    try {
      parse(input);
      expect.fail('Expected a validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentProposalValidationError);
      expect((error as Error).message).toBe('Invalid content proposal.');
      expect(JSON.parse(JSON.stringify(error))).toEqual({
        name: 'ContentProposalValidationError', message: 'Invalid content proposal.',
      });
      expect(String(error)).not.toContain('secret-internal-token');
    }
  });
});

describe('numeric facts', () => {
  it.each([null, 0, 0.01, 0.29, 1.1, 123.45, 99_999_999.99])('accepts Decimal(10,2) gross area %s', grossAreaSqm => {
    expect(parse({ ...unit(), facts: { ...unit().facts, grossAreaSqm } }).facts.grossAreaSqm).toBe(grossAreaSqm);
  });

  it.each([undefined, '', '1.23', true, {}, [], NaN, Infinity, -Infinity, -0.01, 0.001, 1.001, 1.0000000000000002, 1e-10, 100_000_000, 99_999_999.999])('rejects invalid gross area %s', grossAreaSqm => {
    expect(() => parse({ ...unit(), facts: { ...unit().facts, grossAreaSqm } })).toThrow(ContentProposalValidationError);
  });

  it.each(['bedrooms', 'bathrooms', 'maxGuests'] as const)('bounds unit %s to integer 0..1000', key => {
    for (const value of [...numericInvalids, 1001]) {
      expect(() => parse({ ...unit(), facts: { ...unit().facts, [key]: value } })).toThrow(ContentProposalValidationError);
    }
    for (const value of [0, 1, 1000]) {
      expect(parse({ ...unit(), facts: { ...unit().facts, [key]: value } }).facts[key]).toBe(value);
    }
  });

  it.each(['unit', 'project'] as const)('bounds nullable %s size/count to integer 0..1000000', scope => {
    const key = scope === 'unit' ? 'sizeSqm' : 'totalUnits';
    for (const value of [...numericInvalids.filter(value => value !== null), 1_000_001]) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: value });
      expect(() => parseContentProposal(scope, input)).toThrow(ContentProposalValidationError);
    }
    for (const value of [null, 0, 1_000_000]) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: value });
      expect(parseContentProposal(scope, input).facts).toHaveProperty(key, value);
    }
  });
});

describe('string facts and exact enums', () => {
  const stringFields = [
    ['unit', 'name', 160, true, false], ['unit', 'floor', 40, false, true],
    ['unit', 'addressSupplement', 500, false, false], ['project', 'name', 160, true, false],
    ['project', 'brand', 160, false, true], ['project', 'address', 500, true, false],
    ['project', 'city', 160, false, true], ['project', 'district', 160, false, true],
  ] as const;

  it.each(stringFields)('validates %s.%s at length %s (required=%s, nullable=%s)', (scope, key, limit, required, nullable) => {
    for (const value of [undefined, 1, true, {}, [], new String('value'), 'x'.repeat(limit + 1), ...(nullable ? [] : [null])]) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: value });
      expect(() => parseContentProposal(scope, input)).toThrow(ContentProposalValidationError);
    }
    for (const value of ['x'.repeat(limit), ...(required ? [] : ['']), ...(nullable ? [null] : [])]) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: value });
      expect(parseContentProposal(scope, input).facts).toHaveProperty(key, value);
    }
    if (required) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: ' \n\t ' });
      expect(() => parseContentProposal(scope, input)).toThrow(ContentProposalValidationError);
    }
  });

  it.each(['resort', 'condominium', 'villa_estate', 'standalone', null])('accepts projectType %s', value => {
    const input = project();
    Object.assign(input.facts, { projectType: value });
    expect(parseContentProposal('project', input).facts.projectType).toBe(value);
  });

  it.each(['hotel', '', ' resort ', 'RESORT', undefined, 1, {}, []])('rejects projectType %s', value => {
    const input = project();
    Object.assign(input.facts, { projectType: value });
    expect(() => parseContentProposal('project', input)).toThrow(ContentProposalValidationError);
  });
});

describe('explicit-locale description', () => {
  it.each(['ru', 'en', 'th', 'zh'] as const)('accepts explicit %s without guessing text language', locale => {
    const input = { ...unit(), description: { locale, value: 'English text ภาษาไทย 中文 Русский' } };
    expect(parse(input).description).toEqual(input.description);
  });

  it.each(['RU', ' en ', 'fr', '', null, undefined, 1, []])('rejects locale %s', locale => {
    expect(() => parse({ ...unit(), description: { locale, value: 'Text' } })).toThrow(ContentProposalValidationError);
  });

  it('requires nonempty string text up to 3000 characters', () => {
    for (const value of ['', ' \n\t ', 'x'.repeat(3001), null, undefined, 1, [], {}]) {
      expect(() => parse({ ...unit(), description: { locale: 'en', value } })).toThrow(ContentProposalValidationError);
    }
    expect(parse({ ...unit(), description: { locale: 'en', value: 'x'.repeat(3000) } }).description?.value).toHaveLength(3000);
  });

  it('accepts null but rejects every other malformed description', () => {
    expect(parse(unit()).description).toBeNull();
    for (const description of invalidValues.filter(value => value !== null)) {
      expect(() => parse({ ...unit(), description })).toThrow(ContentProposalValidationError);
    }
  });
});

describe('bounded content lists', () => {
  it('requires unit amenities to be dense unique trimmed strings, at most 100', () => {
    const scope = 'unit';
    const key = 'amenityKeys';
    for (const value of [null, undefined, {}, 'wifi', [1], [null], [''], ['  '], ['x'.repeat(101)], ['wifi', ' wifi '], Array.from({ length: 101 }, (_, i) => `key-${i}`), Array(1)]) {
      const input = proposal(scope);
      Object.assign(input.facts, { [key]: value });
      expect(() => parseContentProposal(scope, input)).toThrow(ContentProposalValidationError);
    }
    const input = proposal(scope);
    Object.assign(input.facts, { [key]: Array.from({ length: 100 }, (_, i) => `key-${i}`) });
    expect((parseContentProposal(scope, input).facts as unknown as Record<string, string[]>)[key]).toHaveLength(100);
  });

  it('accepts 100-character entries and rejects exotic arrays', () => {
    const input = unit();
    input.facts.amenityKeys = ['x'.repeat(100)];
    expect(parse(input).facts.amenityKeys[0]).toHaveLength(100);
    for (const key of ['__proto__', 'constructor', 'prototype', 'ownerId', Symbol('extra')]) {
      const altered = unit();
      Object.defineProperty(altered.facts.amenityKeys, key, { value: 'bad', enumerable: true });
      expect(() => parse(altered)).toThrow(ContentProposalValidationError);
    }
    const subclass = unit();
    class List extends Array<string> {}
    subclass.facts.amenityKeys = new List();
    expect(() => parse(subclass)).toThrow(ContentProposalValidationError);
  });
});

describe('gallery', () => {
  it('preserves ordering and accepts a null cover or a selected image', () => {
    for (const coverMediaId of [null, MEDIA_B]) {
      const gallery = { mediaIds: [MEDIA_A, MEDIA_B], coverMediaId };
      expect(parse({ ...unit(), gallery }).gallery).toEqual(gallery);
    }
  });

  it('rejects duplicate IDs and a cover absent from the ordered gallery', () => {
    expect(() => parse({ ...unit(), gallery: { mediaIds: [MEDIA_A, MEDIA_A], coverMediaId: MEDIA_A } })).toThrow(ContentProposalValidationError);
    expect(() => parse({ ...unit(), gallery: { mediaIds: [MEDIA_A], coverMediaId: MEDIA_B } })).toThrow(ContentProposalValidationError);
    expect(() => parse({ ...unit(), gallery: { mediaIds: [], coverMediaId: MEDIA_A } })).toThrow(ContentProposalValidationError);
  });

  it.each(['', 'media-1', MEDIA_A.toUpperCase(), ` ${MEDIA_A}`, `${MEDIA_A} `, MEDIA_A.replaceAll('-', ''), `{${MEDIA_A}}`, `urn:uuid:${MEDIA_A}`, MEDIA_A.replace('a', 'g'), null, undefined, 1, {}, []])('rejects noncanonical media ID %s', id => {
    expect(() => parse({ ...unit(), gallery: { mediaIds: [id], coverMediaId: null } })).toThrow(ContentProposalValidationError);
    if (id !== null) {
      expect(() => parse({ ...unit(), gallery: { mediaIds: [MEDIA_A], coverMediaId: id } })).toThrow(ContentProposalValidationError);
    }
  });

  it('accepts 200 media and rejects 201, sparse arrays and nonarrays', () => {
    const mediaIds = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(parse({ ...unit(), gallery: { mediaIds, coverMediaId: mediaIds[199] } }).gallery.mediaIds).toHaveLength(200);
    for (const invalidMediaIds of [[...mediaIds, MEDIA_A], Array(1), null, undefined, {}, MEDIA_A]) {
      expect(() => parse({ ...unit(), gallery: { mediaIds: invalidMediaIds, coverMediaId: null } })).toThrow(ContentProposalValidationError);
    }
  });
});

describe('scope and target binding primitives', () => {
  it.each(['unit', 'project'] as const)('accepts exact scope %s', scope => {
    expect(parseScope(scope)).toBe(scope);
  });

  it.each(['UNIT', ' unit ', 'owner', '', null, undefined, 1, {}, [], '__proto__'])('rejects scope %s', scope => {
    expect(() => parseScope(scope)).toThrow(ContentProposalValidationError);
    expect(() => parseContentProposal(scope as ContentScope, unit())).toThrow(ContentProposalValidationError);
  });

  it.each(['managed-legendary-d201', MEDIA_A, 'unit_01-ABC', 'x', 'x'.repeat(160)])('accepts safe target %s', target => {
    expect(parseTargetId(target)).toBe(target);
  });

  it.each(['', 'x'.repeat(161), ' unit-1', 'unit-1 ', '../unit', 'a/b', 'a\\b', '/unit', 'a?b', 'a#b', 'a.b', 'a%2fb', 'https://host/a', 'a\n', 'a\0b', 'unit😀', '---', '__proto__', null, undefined, 1, {}, [], new String('unit')])('rejects unsafe target %s', target => {
    expect(() => parseTargetId(target)).toThrow(ContentProposalValidationError);
  });
});
