import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  siteUrl,
  publicPageAlternates,
  faqPageJsonLd,
  unitJsonLd,
  serializeJsonLd,
} from './seo';

/**
 * T-035 DoD: the structured data validates.
 *
 * These assert the shape a crawler actually consumes — required schema.org
 * fields present and correctly typed, and nothing asserted that the platform
 * cannot back up.
 */
describe('SEO structured data (T-035, doc 08 §7)', () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'https://myuno.app';
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalUrl;
  });

  describe('siteUrl', () => {
    it('strips a trailing slash so joined paths never double up', () => {
      process.env.NEXTAUTH_URL = 'https://myuno.app/';
      expect(siteUrl()).toBe('https://myuno.app');
      expect(`${siteUrl()}/units/abc`).toBe('https://myuno.app/units/abc');
    });
  });

  describe('canonical + hreflang', () => {
    it('gives an absolute canonical and one alternate per platform locale', () => {
      const alternates = publicPageAlternates('/owners');

      expect(alternates.canonical).toBe('https://myuno.app/owners');
      // ru/en/th/zh plus x-default — a crawler needs the default named
      // explicitly or it guesses.
      expect(Object.keys(alternates.languages).sort()).toEqual([
        'en',
        'ru',
        'th',
        'x-default',
        'zh',
      ]);
    });

    it('points x-default at the platform default locale', () => {
      const { languages } = publicPageAlternates('/owners');
      expect(languages['x-default']).toBe(languages.ru);
    });

    it('keeps every alternate absolute and on the canonical path', () => {
      const { canonical, languages } = publicPageAlternates('/legal/privacy');

      for (const url of Object.values(languages)) {
        expect(url.startsWith(canonical)).toBe(true);
      }
    });

    it('does not leave a trailing slash on a nested path', () => {
      expect(publicPageAlternates('/legal/terms/').canonical).toBe(
        'https://myuno.app/legal/terms'
      );
    });

    it('keeps the root canonical as a single slash', () => {
      expect(publicPageAlternates('/').canonical).toBe('https://myuno.app/');
    });
  });

  describe('FAQPage', () => {
    it('emits a Question/Answer pair per entry', () => {
      const graph = faqPageJsonLd([
        { question: 'What does it cost?', answer: 'A share of what your unit earns.' },
        { question: 'Who gets in?', answer: 'Every entry is logged.' },
      ]) as { '@context': string; '@type': string; mainEntity: Array<Record<string, any>> };

      expect(graph['@context']).toBe('https://schema.org');
      expect(graph['@type']).toBe('FAQPage');
      expect(graph.mainEntity).toHaveLength(2);
      expect(graph.mainEntity[0]['@type']).toBe('Question');
      expect(graph.mainEntity[0].name).toBe('What does it cost?');
      expect(graph.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
      expect(graph.mainEntity[0].acceptedAnswer.text).toBe(
        'A share of what your unit earns.'
      );
    });

    it('drops an entry whose answer has not been written', () => {
      const graph = faqPageJsonLd([
        { question: 'Answered', answer: 'Yes.' },
        { question: 'Unwritten', answer: '' },
        { question: '', answer: 'Orphan answer.' },
      ]) as { mainEntity: Array<{ name: string }> };

      // A blank answer in the graph is a promise the page cannot keep.
      expect(graph.mainEntity.map((q) => q.name)).toEqual(['Answered']);
    });

    it('emits no graph at all when nothing is answered', () => {
      expect(faqPageJsonLd([])).toBeNull();
      expect(faqPageJsonLd([{ question: 'Q', answer: '   ' }])).toBeNull();
    });
  });

  describe('unit Accommodation + Offer', () => {
    const unit = {
      id: 'unit-1',
      name: 'B-707',
      description: 'A sea-view two-bedroom.',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      sizeSqm: 84,
      baseNightlyThb: 4500,
      coverUrl: 'https://cdn.example/b707.jpg',
      project: {
        name: 'Layantara',
        address: '1 Layan Beach Rd, Phuket',
        latitude: 8.0,
        longitude: 98.29,
      },
    };

    it('carries the schema.org fields a lodging listing needs', () => {
      const graph = unitJsonLd(unit) as Record<string, any>;

      expect(graph['@context']).toBe('https://schema.org');
      expect(graph['@type']).toBe('Accommodation');
      expect(graph['@id']).toBe('https://myuno.app/units/unit-1');
      expect(graph.name).toBe('B-707');
      expect(graph.numberOfBedrooms).toBe(2);
      expect(graph.numberOfBathroomsTotal).toBe(1);
      expect(graph.occupancy).toMatchObject({ '@type': 'QuantitativeValue', maxValue: 4 });
      expect(graph.floorSize).toMatchObject({ value: 84, unitCode: 'MTK' });
      expect(graph.geo).toMatchObject({
        '@type': 'GeoCoordinates',
        latitude: 8.0,
        longitude: 98.29,
      });
      expect(graph.containedInPlace).toMatchObject({
        '@type': 'LodgingBusiness',
        name: 'Layantara',
      });
    });

    it('prices the offer in THB from the unit-s own nightly rate', () => {
      const graph = unitJsonLd(unit) as { offers: Record<string, unknown> };

      expect(graph.offers).toMatchObject({
        '@type': 'Offer',
        price: 4500,
        priceCurrency: 'THB',
        url: 'https://myuno.app/units/unit-1',
      });
    });

    it('claims no availability, because a rate is not a free night', () => {
      const graph = unitJsonLd(unit) as { offers: Record<string, unknown> };

      expect(graph.offers).not.toHaveProperty('availability');
    });

    it('omits optional fields rather than emitting empty ones', () => {
      const graph = unitJsonLd({
        ...unit,
        description: null,
        sizeSqm: null,
        coverUrl: null,
      }) as Record<string, unknown>;

      expect(graph).not.toHaveProperty('description');
      expect(graph).not.toHaveProperty('floorSize');
      expect(graph).not.toHaveProperty('image');
      // The required core survives the omissions.
      expect(graph['@type']).toBe('Accommodation');
      expect(graph.offers).toBeDefined();
    });

    it('serialises to valid JSON — this is what ships inside the script tag', () => {
      const serialised = JSON.stringify(unitJsonLd(unit));

      expect(() => JSON.parse(serialised)).not.toThrow();
      expect(JSON.parse(serialised)['@type']).toBe('Accommodation');
    });
  });

  describe('serializeJsonLd', () => {
    // The attack: a unit name, project name or FAQ answer is admin-editable, so
    // a content editor can put `</script>` in one. Raw JSON.stringify would end
    // the script element there and the browser would parse the rest as markup.
    it('escapes a </script> payload so it cannot close the script element', () => {
      const payload = '</script><img src=x onerror=alert(1)>';
      const out = serializeJsonLd({ name: payload });

      expect(out).not.toContain('</script>');
      expect(out).not.toContain('<img');
      expect(out).toContain('\\u003c');
    });

    it('round-trips through JSON.parse — crawlers still read the real value', () => {
      const payload = '</script><b>Villa & Co</b>';
      const parsed = JSON.parse(serializeJsonLd({ name: payload })) as {
        name: string;
      };

      // Escaped on the wire, identical after parsing: the escaping is lossless.
      expect(parsed.name).toBe(payload);
    });

    it('escapes the ampersand and the JS line terminators', () => {
      const out = serializeJsonLd({ a: '&', b: '\u2028', c: '\u2029' });

      expect(out).not.toContain('&');
      expect(out).toContain('\\u0026');
      expect(out).toContain('\\u2028');
      expect(out).toContain('\\u2029');
    });

    it('leaves an ordinary payload structurally intact', () => {
      const graph = faqPageJsonLd([
        { question: 'Is the escaping lossless?', answer: 'Yes — parse it back.' },
      ]);
      const parsed = JSON.parse(serializeJsonLd(graph)) as Record<string, unknown>;

      expect(parsed['@type']).toBe('FAQPage');
      expect((parsed.mainEntity as unknown[])).toHaveLength(1);
    });
  });
});
