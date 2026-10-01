import type { PrismaClient } from '@prisma/client';

export type PassportEvidenceStatus = 'documented' | 'partial' | 'not_evidenced';

export interface PublicProjectPassport {
  project: {
    id: string;
    slug: string;
    name: string;
    address: string;
    projectType: string | null;
    completionYear: number | null;
    totalUnits: number | null;
    latitude: number | null;
    longitude: number | null;
  };
  facts: {
    liveUnits: number;
    activeOfferingCounts: Record<string, number>;
  };
  developer: {
    status: PassportEvidenceStatus;
    organizations: Array<{ name: string; roleKey: string; verification: string | null }>;
  };
  regulatory: {
    status: PassportEvidenceStatus;
    credentials: Array<{
      credentialType: string;
      requirementKey: string;
      issuingAuthority: string | null;
      verificationStatus: string;
      verifiedAt: string | null;
      expiryDate: string | null;
      current: boolean;
    }>;
  };
  unitCompliance: {
    status: PassportEvidenceStatus;
    liveUnitCount: number;
    byType: Array<{ type: string; confirmedUnits: number; totalUnits: number }>;
  };
  generatedAt: string;
}

const currentCredential = (credential: {
  status: string;
  verificationStatus: string;
  expiryDate: Date | null;
}) =>
  credential.status === 'active' &&
  credential.verificationStatus === 'verified' &&
  (!credential.expiryDate || credential.expiryDate.getTime() >= Date.now());

export async function getPublicProjectPassport(
  db: PrismaClient,
  slug: string
): Promise<PublicProjectPassport | null> {
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      projectType: true,
      completionYear: true,
      totalUnits: true,
      latitude: true,
      longitude: true,
      status: true,
      orgRoles: {
        select: {
          roleKey: true,
          provenance: true,
          effectiveFrom: true,
          effectiveTo: true,
          organization: {
            select: {
              name: true,
              status: true,
              developerVerification: true,
            },
          },
        },
      },
      regulatoryCredentials: {
        select: {
          requirementKey: true,
          credentialType: true,
          issuingAuthority: true,
          status: true,
          verificationStatus: true,
          verifiedAt: true,
          expiryDate: true,
        },
      },
      units: {
        where: { status: 'live', assetStatus: { not: 'suspended' } },
        select: {
          id: true,
          commercialOfferings: {
            where: { status: 'active' },
            select: { offeringType: true },
          },
          complianceRecords: {
            where: { status: 'confirmed' },
            select: { recordType: true },
          },
        },
      },
    },
  });

  if (!project || project.status !== 'live') return null;

  const now = new Date();
  const organizations = project.orgRoles
    .filter(
      (role) =>
        role.provenance === 'verified' &&
        role.organization.status === 'active' &&
        (!role.effectiveFrom || role.effectiveFrom <= now) &&
        (!role.effectiveTo || role.effectiveTo >= now)
    )
    .map((role) => ({
      name: role.organization.name,
      roleKey: role.roleKey,
      verification: role.organization.developerVerification,
    }));

  const verifiedOrganizations = organizations.filter(
    (organization) => organization.verification === 'verified'
  );
  const developerStatus: PassportEvidenceStatus =
    verifiedOrganizations.length > 0
      ? 'documented'
      : organizations.length > 0
        ? 'partial'
        : 'not_evidenced';

  const credentials = project.regulatoryCredentials.map((credential) => ({
    credentialType: credential.credentialType,
    requirementKey: credential.requirementKey,
    issuingAuthority: credential.issuingAuthority,
    verificationStatus: credential.verificationStatus,
    verifiedAt: credential.verifiedAt?.toISOString() ?? null,
    expiryDate: credential.expiryDate?.toISOString() ?? null,
    current: currentCredential(credential),
  }));
  const currentCredentials = credentials.filter((credential) => credential.current);
  const regulatoryStatus: PassportEvidenceStatus =
    currentCredentials.length > 0
      ? 'documented'
      : credentials.length > 0
        ? 'partial'
        : 'not_evidenced';

  const complianceTypes = new Map<string, Set<string>>();
  const offeringCounts = new Map<string, number>();
  for (const unit of project.units) {
    for (const offering of unit.commercialOfferings) {
      offeringCounts.set(
        offering.offeringType,
        (offeringCounts.get(offering.offeringType) ?? 0) + 1
      );
    }
    for (const record of unit.complianceRecords) {
      const set = complianceTypes.get(record.recordType) ?? new Set<string>();
      set.add(unit.id);
      complianceTypes.set(record.recordType, set);
    }
  }

  const byType = Array.from(complianceTypes.entries())
    .map(([type, units]) => ({
      type,
      confirmedUnits: units.size,
      totalUnits: project.units.length,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const hasFullCoverage =
    project.units.length > 0 &&
    byType.length > 0 &&
    byType.some((item) => item.confirmedUnits === project.units.length);
  const unitComplianceStatus: PassportEvidenceStatus = hasFullCoverage
    ? 'documented'
    : byType.length > 0
      ? 'partial'
      : 'not_evidenced';

  const lat = Number(project.latitude);
  const lng = Number(project.longitude);

  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      address: project.address,
      projectType: project.projectType,
      completionYear: project.completionYear,
      totalUnits: project.totalUnits,
      latitude: Number.isFinite(lat) && lat !== 0 ? lat : null,
      longitude: Number.isFinite(lng) && lng !== 0 ? lng : null,
    },
    facts: {
      liveUnits: project.units.length,
      activeOfferingCounts: Object.fromEntries(
        Array.from(offeringCounts.entries()).sort(([a], [b]) => a.localeCompare(b))
      ),
    },
    developer: {
      status: developerStatus,
      organizations: organizations.map(({ name, roleKey, verification }) => ({
        name,
        roleKey,
        verification,
      })),
    },
    regulatory: {
      status: regulatoryStatus,
      credentials,
    },
    unitCompliance: {
      status: unitComplianceStatus,
      liveUnitCount: project.units.length,
      byType,
    },
    generatedAt: new Date().toISOString(),
  };
}
