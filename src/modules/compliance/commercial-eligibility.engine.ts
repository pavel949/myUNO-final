import { PrismaClient } from '@prisma/client';

export interface CommercialEligibilityQuery {
  unitId: string;
  offeringType: 'short_term_stay' | 'long_term_rental' | 'sale' | 'serviced_residence';
  channel?: 'airbnb' | 'booking_com' | 'agoda' | 'direct' | 'ddproperty' | 'fazwaz';
}

export interface CommercialEligibilityResult {
  eligible: boolean;
  unitId: string;
  offeringType: string;
  channel?: string;
  completenessScore: number;
  blockingReasons: string[];
  missingCredentials: string[];
}

/**
 * Commercial Eligibility Engine
 *
 * Resolves physical property facts, developer organization context,
 * commercial offering definitions, and active jurisdictional regulatory credentials
 * to decide whether an asset can go live or be distributed.
 */
export async function evaluateCommercialEligibility(
  db: PrismaClient,
  query: CommercialEligibilityQuery
): Promise<CommercialEligibilityResult> {
  const { unitId, offeringType, channel } = query;

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: {
        include: {
          orgRoles: {
            include: { organization: true },
          },
          regulatoryCredentials: true,
        },
      },
      sleepingSpaces: {
        include: { beds: true },
      },
      commercialOfferings: {
        where: { offeringType },
        include: { channelMappings: true },
      },
      regulatoryCredentials: true,
    },
  });

  if (!unit) {
    return {
      eligible: false,
      unitId,
      offeringType,
      channel,
      completenessScore: 0,
      blockingReasons: ['PROPERTY_FACTS_INCOMPLETE'],
      missingCredentials: [],
    };
  }

  const blockingReasons: string[] = [];
  const missingCredentials: string[] = [];

  // 1. Physical Property Facts Check
  if (!unit.bedrooms || !unit.bathrooms || !unit.maxGuests) {
    blockingReasons.push('PROPERTY_FACTS_INCOMPLETE');
  }

  // 2. Sleeping Layout Check (Mandatory for short-term stay / Airbnb parity)
  if (offeringType === 'short_term_stay') {
    const totalBeds = unit.sleepingSpaces.reduce(
      (sum, space) => sum + space.beds.reduce((bSum, bed) => bSum + bed.count, 0),
      0
    );
    if (unit.sleepingSpaces.length === 0 || totalBeds === 0) {
      blockingReasons.push('SLEEPING_LAYOUT_INCOMPLETE');
    }
  }

  // 3. Jurisdictional Regulatory Credentials Check (Thailand jurisdiction default)
  if (offeringType === 'short_term_stay') {
    const projectCredentials = unit.project.regulatoryCredentials;
    const unitCredentials = unit.regulatoryCredentials;
    const allCredentials = [...projectCredentials, ...unitCredentials];

    const hasHotelLicence = allCredentials.some(
      (c) => c.credentialType === 'hotel_business_license' && c.status === 'active'
    );
    const hasExemption = allCredentials.some(
      (c) => c.credentialType === 'accommodation_exemption' && c.status === 'active'
    );

    if (!hasHotelLicence && !hasExemption) {
      blockingReasons.push('REQUIRED_CREDENTIAL_MISSING');
      missingCredentials.push('hotel_business_license', 'accommodation_exemption');
    }
  }

  if (offeringType === 'sale') {
    const allCredentials = [...unit.project.regulatoryCredentials, ...unit.regulatoryCredentials];
    const hasTitleVerification = allCredentials.some(
      (c) => c.credentialType === 'title_legal_use' && c.status === 'active'
    );
    if (!hasTitleVerification) {
      blockingReasons.push('REQUIRED_CREDENTIAL_MISSING');
      missingCredentials.push('title_legal_use');
    }
  }

  // 4. Channel Specific Checks
  if (channel && offeringType === 'short_term_stay') {
    if (!unit.amenityKeys || unit.amenityKeys.length === 0) {
      blockingReasons.push('CHANNEL_REQUIRED_FIELD_MISSING');
    }
  }

  const eligible = blockingReasons.length === 0;

  // Calculate overall completeness percentage
  let score = 100;
  if (blockingReasons.includes('PROPERTY_FACTS_INCOMPLETE')) score -= 30;
  if (blockingReasons.includes('SLEEPING_LAYOUT_INCOMPLETE')) score -= 30;
  if (blockingReasons.includes('REQUIRED_CREDENTIAL_MISSING')) score -= 30;
  if (blockingReasons.includes('CHANNEL_REQUIRED_FIELD_MISSING')) score -= 10;
  score = Math.max(0, score);

  return {
    eligible,
    unitId,
    offeringType,
    channel,
    completenessScore: score,
    blockingReasons,
    missingCredentials,
  };
}

export async function canPublishShortTerm(db: PrismaClient, unitId: string) {
  return await evaluateCommercialEligibility(db, { unitId, offeringType: 'short_term_stay' });
}

export async function canPublishLongTerm(db: PrismaClient, unitId: string) {
  return await evaluateCommercialEligibility(db, { unitId, offeringType: 'long_term_rental' });
}

export async function canPublishSale(db: PrismaClient, unitId: string) {
  return await evaluateCommercialEligibility(db, { unitId, offeringType: 'sale' });
}
