import { LOCALES, DEFAULT_LOCALE } from '@/modules/content/types';

/**
 * SEO helpers (doc 08 §7). The canonical site origin comes from
 * NEXTAUTH_URL — the same base the auth emails and checkout links use —
 * so every environment (local, preview, production) stays consistent.
 */
export function siteUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Canonical + hreflang for a public page (doc 08 §7).
 *
 * The same URL serves every language — the locale comes from the request, not
 * the path — so each alternate points at the canonical with a `?lang=` hint
 * and `x-default` names the platform default. Getting this wrong is worse
 * than omitting it: pointing hreflang at URLs that do not exist teaches a
 * crawler the site is broken.
 *
 * `path` is root-relative and must start with "/".
 */
export function publicPageAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const canonical = `${siteUrl()}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
  const separator = canonical.includes('?') ? '&' : '?';

  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = `${canonical}${separator}lang=${locale}`;
  }
  languages['x-default'] = `${canonical}${separator}lang=${DEFAULT_LOCALE}`;

  return { canonical, languages };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * `FAQPage` structured data for the audience FAQs (doc 08 §7).
 *
 * Entries whose question or answer is missing are dropped rather than emitted
 * empty: an FAQ key that has not been written yet is absent from the graph,
 * never present as a blank promise. With nothing left, this returns null and
 * the page emits no FAQ graph at all.
 */
export function faqPageJsonLd(entries: FaqEntry[]): Record<string, unknown> | null {
  const answered = entries.filter((e) => e.question?.trim() && e.answer?.trim());
  if (answered.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answered.map((entry) => ({
      '@type': 'Question',
      name: entry.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer.trim(),
      },
    })),
  };
}

export interface UnitJsonLdInput {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  baseNightlyThb: number;
  coverUrl: string | null;
  project: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

/**
 * `Accommodation` + `Offer` for a unit detail page (doc 08 §7).
 *
 * The offer carries the unit's nightly rate in THB — the same server-computed
 * base the booking widget prices from, never a decorated marketing number.
 * Availability is deliberately absent: a nightly rate is not a promise that
 * any particular night is free, and claiming otherwise in structured data
 * would be a lie a crawler repeats.
 */
export function unitJsonLd(unit: UnitJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    '@id': `${siteUrl()}/units/${unit.id}`,
    name: unit.name,
    ...(unit.description ? { description: unit.description } : {}),
    numberOfBedrooms: unit.bedrooms,
    numberOfBathroomsTotal: unit.bathrooms,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: unit.maxGuests,
      unitCode: 'C62', // UN/CEFACT code for "one" — i.e. a count of people
    },
    ...(unit.sizeSqm
      ? {
          floorSize: {
            '@type': 'QuantitativeValue',
            value: unit.sizeSqm,
            unitCode: 'MTK', // square metre
          },
        }
      : {}),
    ...(unit.coverUrl ? { image: unit.coverUrl } : {}),
    address: unit.project.address,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: unit.project.latitude,
      longitude: unit.project.longitude,
    },
    containedInPlace: {
      '@type': 'LodgingBusiness',
      name: unit.project.name,
    },
    offers: {
      '@type': 'Offer',
      price: unit.baseNightlyThb,
      priceCurrency: 'THB',
      url: `${siteUrl()}/units/${unit.id}`,
    },
  };
}
