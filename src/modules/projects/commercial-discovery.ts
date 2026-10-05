import type { PrismaClient } from '@prisma/client';
import { allExcludedSourceControlledUnitIds } from '@/modules/booking/source-authority';
import { isCredentialCurrentlyVerified } from '@/modules/compliance/commercial-eligibility.engine';
import { assessGalleryReadiness } from '@/modules/media/public-readiness';
import {
  matchesLongTermLeaseSearch,
  normalizeLongTermLeaseTerms,
  type LongTermLeaseSearch,
  type LongTermLeaseTerms,
} from './long-term-lease';

/**
 * Enquiry-only sale / long-lease discovery. Do not reuse the Stay read model:
 * a physical asset may have independent commercial rights and no live nightly rate.
 * No legal document, ownership ID or raw pricing JSON leaves this boundary.
 */
export type HomeIntent = 'buy' | 'rent';
export interface PublicCommercialHome {
  id: string;
  name: string;
  project: { id: string; name: string; slug: string; areaSlug: string | null };
  unitType: 'villa' | 'condo' | 'townhouse';
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number | null;
  imageUrl: string | null;
  images: string[];
  intents: HomeIntent[];
  priceThb: Partial<Record<HomeIntent, number>>;
  leaseTerms: LongTermLeaseTerms | null;
}

const kinds = ['sale', 'long_term_rental'];

export function publicOfferingPriceThb(
  offeringType: string,
  pricingTerms: unknown,
): { intent: HomeIntent; amountThb: number } | null {
  if (!pricingTerms || typeof pricingTerms !== 'object' || Array.isArray(pricingTerms)) return null;
  const terms = pricingTerms as Record<string, unknown>;
  const numeric = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (offeringType === 'sale') {
    const amount = numeric(terms.askingPriceThb);
    return amount ? { intent: 'buy', amountThb: amount } : null;
  }
  if (offeringType === 'long_term_rental') {
    const amount = numeric(terms.monthlyRentThb) ?? numeric(terms.monthlyThb);
    return amount ? { intent: 'rent', amountThb: amount } : null;
  }
  return null;
}
type Credential = {
  credentialType: string; status: string; verificationStatus: string;
  evidenceMediaId: string | null; expiryDate: Date | null; effectiveDate: Date | null;
};
const hasValidEvidence = (credentials: Credential[], type: string, now: Date) =>
  credentials.some(c => c.credentialType === type && isCredentialCurrentlyVerified(c, now));

export function eligiblePublicHomeIntents(input: {
  credentials: Credential[];
  permittedUseConfirmedAt: Date | null;
  complianceRecords: Array<{ recordType: string; status: string }>;
  engagements: Array<{ status: string; mandateMediaId: string | null; startsOn: Date | null; endsOn: Date | null }>;
  commercialOfferings: Array<{ offeringType: string; status: string }>;
  sourceBookingOwned?: boolean;
}, now: Date = new Date()): HomeIntent[] {
  const active = new Set(input.commercialOfferings.filter(o => o.status === 'active').map(o => o.offeringType));
  const result: HomeIntent[] = [];
  // Title alone is not permission to sell; require separately evidenced marketing authority.
  if (active.has('sale') && hasValidEvidence(input.credentials, 'title_legal_use', now) &&
      hasValidEvidence(input.credentials, 'sale_authority', now)) result.push('buy');
  const hasMandate = input.engagements.some(e => e.status === 'active' && Boolean(e.mandateMediaId) &&
    (!e.startsOn || e.startsOn <= now) && (!e.endsOn || e.endsOn > now));
  const permitted = Boolean(input.permittedUseConfirmedAt) &&
    input.complianceRecords.some(c => c.recordType === 'permitted_use' && c.status === 'confirmed');
  if (active.has('long_term_rental') && !input.sourceBookingOwned && hasMandate && permitted) result.push('rent');
  return result;
}

export async function listPublicCommercialHomes(
  db: PrismaClient,
  intent?: HomeIntent,
  unitId?: string,
  projectId?: string,
  leaseSearch: LongTermLeaseSearch = {},
): Promise<PublicCommercialHome[]> {
  const sourceExcluded = new Set(await allExcludedSourceControlledUnitIds(db));
  const rows = await db.unit.findMany({
    where: {
      ...(unitId ? { id: unitId } : {}),
      ...(projectId ? { projectId } : {}),
      status: 'live', assetStatus: { not: 'suspended' },
      project: { status: 'live' },
      commercialOfferings: { some: { status: 'active', offeringType: { in: kinds } } },
      // Exact sale/lease inventory must carry its own truthful gallery. The
      // detailed readiness check below enforces cover membership and photo
      // quality; this coarse filter only avoids loading obviously empty rows.
      coverMediaId: { not: null },
      media: { some: {} },
    },
    select: {
      id: true, name: true, unitType: true, bedrooms: true, bathrooms: true, sizeSqm: true,
      permittedUseConfirmedAt: true,
      project: { select: { id: true, name: true, slug: true, area: { select: { slug: true } } } },
      coverMediaId: true,
      coverMedia: {
        select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
      },
      media: {
        orderBy: { sort: 'asc' },
        include: {
          media: {
            select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
          },
        },
      },
      regulatoryCredentials: { select: {
        credentialType: true, status: true, verificationStatus: true,
        evidenceMediaId: true, expiryDate: true, effectiveDate: true,
      } },
      complianceRecords: { select: { recordType: true, status: true } },
      engagements: { select: { status: true, mandateMediaId: true, startsOn: true, endsOn: true } },
      commercialOfferings: {
        where: { offeringType: { in: kinds } },
        select: { offeringType: true, status: true, pricingTerms: true, rulesAndPolicies: true },
      },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    take: unitId ? 1 : projectId ? 100 : 200,
  });
  const now = new Date();
  return rows.flatMap(row => {
    const media = assessGalleryReadiness({
      coverMediaId: row.coverMediaId,
      links: row.media,
    });
    if (!media.ready) return [];

    const intents = eligiblePublicHomeIntents({
      credentials: row.regulatoryCredentials,
      permittedUseConfirmedAt: row.permittedUseConfirmedAt,
      complianceRecords: row.complianceRecords,
      engagements: row.engagements,
      commercialOfferings: row.commercialOfferings,
      sourceBookingOwned: sourceExcluded.has(row.id),
    }, now);
    if (!intents.length || (intent && !intents.includes(intent))) return [];
    const priceThb: Partial<Record<HomeIntent, number>> = {};
    let leaseTerms: LongTermLeaseTerms | null = null;
    for (const offering of row.commercialOfferings) {
      if (offering.status !== 'active') continue;
      const normalized = publicOfferingPriceThb(offering.offeringType, offering.pricingTerms);
      if (normalized) priceThb[normalized.intent] = normalized.amountThb;
      if (offering.offeringType === 'long_term_rental') {
        leaseTerms = normalizeLongTermLeaseTerms(offering.pricingTerms, offering.rulesAndPolicies);
      }
    }
    if (intent === 'rent' && leaseTerms && !matchesLongTermLeaseSearch(leaseTerms, leaseSearch)) return [];
    return [{
      id: row.id,
      name: row.name,
      project: { id: row.project.id, name: row.project.name, slug: row.project.slug, areaSlug: row.project.area?.slug ?? null },
      unitType: row.unitType,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      sizeSqm: row.sizeSqm,
      imageUrl: media.coverUrl,
      images: media.coverUrl
        ? [media.coverUrl, ...media.urls.filter((url) => url !== media.coverUrl)]
        : media.urls,
      intents,
      priceThb,
      leaseTerms,
    }];
  });
}

/** Unit-specific public lookup with the identical legal and authority gates as browse. */
export async function getPublicCommercialHomeById(
  db: PrismaClient, unitId: string,
): Promise<PublicCommercialHome | null> {
  const [home] = await listPublicCommercialHomes(db, undefined, unitId);
  return home ?? null;
}
