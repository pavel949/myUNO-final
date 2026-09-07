import { PrismaClient } from '@prisma/client';

export interface DeveloperOrganizationInput {
  name: string;
  legalName?: string;
  tradingName?: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  hqCountry?: string;
  officeAddress?: string;
  registrationNumber?: string;
  taxIdentifier?: string;
  yearEstablished?: number;
  developerTrackRecord?: {
    completedProjects?: number;
    activeProjects?: number;
    plannedProjects?: number;
    totalUnitsDelivered?: number;
  };
  developerVerification?: 'verified' | 'developer_provided' | 'unverified';
}

export interface ProjectOrganizationRoleInput {
  projectId: string;
  organizationId: string;
  roleKey: 'developer' | 'co_developer' | 'operator' | 'management_company' | 'juristic_person' | 'landowner' | 'architect' | 'contractor';
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isPrimary?: boolean;
  notes?: string;
  provenance?: string;
}

export interface SleepingSpaceInput {
  unitId: string;
  spaceType?: string;
  name?: string;
  sortOrder?: number;
  beds?: {
    bedType: string;
    count: number;
  }[];
}

export async function createDeveloperOrganization(
  db: PrismaClient,
  input: DeveloperOrganizationInput
) {
  return await db.organization.create({
    data: {
      name: input.name,
      legalName: input.legalName || input.name,
      tradingName: input.tradingName || input.name,
      orgType: 'developer',
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      website: input.website,
      hqCountry: input.hqCountry,
      officeAddress: input.officeAddress,
      registrationNumber: input.registrationNumber,
      taxIdentifier: input.taxIdentifier,
      yearEstablished: input.yearEstablished,
      developerTrackRecord: input.developerTrackRecord as any,
      developerVerification: input.developerVerification || 'unverified',
    },
  });
}

export async function addProjectOrganizationRole(
  db: PrismaClient,
  input: ProjectOrganizationRoleInput
) {
  return await db.projectOrganizationRole.upsert({
    where: {
      projectId_organizationId_roleKey: {
        projectId: input.projectId,
        organizationId: input.organizationId,
        roleKey: input.roleKey,
      },
    },
    create: {
      projectId: input.projectId,
      organizationId: input.organizationId,
      roleKey: input.roleKey,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes,
      provenance: input.provenance || 'verified',
    },
    update: {
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes,
      provenance: input.provenance || 'verified',
    },
  });
}

export async function getDeveloper360(db: PrismaClient, organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      projectRoles: {
        include: {
          project: true,
        },
      },
      regulatoryCredentials: true,
    },
  });

  if (!org) return null;

  const completeness = calculateDeveloperCompleteness(org);

  return {
    organization: org,
    completeness,
    projects: org.projectRoles.map((pr) => pr.project),
  };
}

export async function getProjectFacts360(db: PrismaClient, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      area: true,
      orgRoles: {
        include: {
          organization: true,
        },
      },
      units: {
        include: {
          sleepingSpaces: {
            include: { beds: true },
          },
          commercialOfferings: true,
          regulatoryCredentials: true,
        },
      },
      commercialOfferings: true,
      regulatoryCredentials: true,
    },
  });

  if (!project) return null;

  const developerRole = project.orgRoles.find((r) => r.roleKey === 'developer');
  const developerOrg = developerRole ? developerRole.organization : null;

  const completenessScore = calculatePropertyFactsCompleteness(project);

  return {
    project,
    developerOrg,
    orgRoles: project.orgRoles,
    unitsCount: project.units.length,
    completenessScore,
  };
}

export async function getUnitFacts360(db: PrismaClient, unitId: string) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: {
        include: {
          orgRoles: {
            include: {
              organization: true,
            },
          },
        },
      },
      sleepingSpaces: {
        include: {
          beds: true,
        },
      },
      commercialOfferings: {
        include: {
          channelMappings: true,
        },
      },
      regulatoryCredentials: true,
    },
  });

  if (!unit) return null;

  const developerRole = unit.project.orgRoles.find((r) => r.roleKey === 'developer');
  const developerOrg = developerRole ? developerRole.organization : null;

  const physicalCompleteness = calculatePropertyFactsCompleteness(unit);
  const developerCompleteness = developerOrg ? calculateDeveloperCompleteness(developerOrg) : 0;

  return {
    unit,
    project: unit.project,
    developerOrg,
    sleepingSpaces: unit.sleepingSpaces,
    commercialOfferings: unit.commercialOfferings,
    regulatoryCredentials: unit.regulatoryCredentials,
    scores: {
      physicalCompleteness,
      developerCompleteness,
    },
  };
}

export function calculatePropertyFactsCompleteness(entity: any): number {
  let points = 0;
  let total = 6;

  if (entity.name) points++;
  if (entity.address || entity.bedrooms !== undefined) points++;
  if (entity.projectType || entity.privacyType || entity.unitType) points++;
  if (entity.latitude !== undefined || entity.usableAreaSqm !== undefined || entity.sizeSqm !== undefined) points++;
  if (entity.facilities?.length > 0 || entity.amenityKeys?.length > 0 || entity.unitFeatures?.length > 0) points++;
  if (entity.sleepingSpaces?.length > 0 || entity.totalUnits !== undefined) points++;

  return Math.round((points / total) * 100);
}

export function calculateDeveloperCompleteness(org: any): number {
  let points = 0;
  let total = 5;

  if (org.name || org.tradingName) points++;
  if (org.legalName) points++;
  if (org.website || org.contactEmail) points++;
  if (org.registrationNumber) points++;
  if (org.developerTrackRecord) points++;

  return Math.round((points / total) * 100);
}
