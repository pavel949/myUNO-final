import type { PrismaClient } from '@prisma/client';

/**
 * Enquiry-only sale / long-lease discovery. Do not reuse the Stay read model:
 * a physical asset may have independent commercial rights and no live nightly rate.
 * No legal document, ownership ID or raw pricing JSON leaves this boundary.
 */
export type HomeIntent = 'buy' | 'rent';
export interface PublicCommercialHome {
  id: string;
  name: string;
  project: { name: string; slug: string };
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number | null;
  imageUrl: string | null;
  intents: HomeIntent[];
}

const kinds = ['sale', 'long_term_rental'];
type Credential = {
  credentialType: string; status: string; verificationStatus: string;
  evidenceMediaId: string | null; expiryDate: Date | null; effectiveDate: Date | null;
};
const hasValidEvidence = (credentials: Credential[], type: string, now: Date) =>
  credentials.some(c => c.credentialType === type && c.status === 'active' &&
    c.verificationStatus === 'verified' && Boolean(c.evidenceMediaId) &&
    (!c.effectiveDate || c.effectiveDate <= now) && (!c.expiryDate || c.expiryDate > now));

export function eligiblePublicHomeIntents(input: {
  credentials: Credential[];
  permittedUseConfirmedAt: Date | null;
  complianceRecords: Array<{ recordType: string; status: string }>;
  engagements: Array<{ status: string; mandateMediaId: string | null; startsOn: Date | null; endsOn: Date | null }>;
  commercialOfferings: Array<{ offeringType: string; status: string }>;
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
  if (active.has('long_term_rental') && hasMandate && permitted) result.push('rent');
  return result;
}

export async function listPublicCommercialHomes(db: PrismaClient, intent?: HomeIntent, unitId?: string): Promise<PublicCommercialHome[]> {
  const rows = await db.unit.findMany({
    where: {
      ...(unitId ? { id: unitId } : {}),
      status: 'live', assetStatus: { not: 'suspended' },
      project: { status: 'live' },
      commercialOfferings: { some: { status: 'active', offeringType: { in: kinds } } },
      OR: [{ coverMediaId: { not: null } }, { media: { some: {} } }],
    },
    select: {
      id: true, name: true, bedrooms: true, bathrooms: true, sizeSqm: true,
      permittedUseConfirmedAt: true,
      project: { select: { name: true, slug: true } },
      coverMedia: { select: { storageKey: true } },
      media: { take: 1, orderBy: { sort: 'asc' }, select: { media: { select: { storageKey: true } } } },
      regulatoryCredentials: { select: {
        credentialType: true, status: true, verificationStatus: true,
        evidenceMediaId: true, expiryDate: true, effectiveDate: true,
      } },
      complianceRecords: { select: { recordType: true, status: true } },
      engagements: { select: { status: true, mandateMediaId: true, startsOn: true, endsOn: true } },
      commercialOfferings: {
        where: { offeringType: { in: kinds } },
        select: { offeringType: true, status: true },
      },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    take: unitId ? 1 : 200,
  });
  const now = new Date();
  return rows.flatMap(row => {
    const intents = eligiblePublicHomeIntents(row, now);
    if (!intents.length || (intent && !intents.includes(intent))) return [];
    return [{
      id: row.id, name: row.name, project: row.project,
      bedrooms: row.bedrooms, bathrooms: row.bathrooms, sizeSqm: row.sizeSqm,
      imageUrl: row.coverMedia?.storageKey ?? row.media[0]?.media.storageKey ?? null,
      intents,
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
