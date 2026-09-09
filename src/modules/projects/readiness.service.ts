import { PrismaClient } from '@prisma/client';

export type ReadinessSeverity = 'blocker' | 'warning';

export interface ReadinessFinding {
  code: string;
  severity: ReadinessSeverity;
  area: 'identity' | 'location' | 'content' | 'inventory' | 'pricing' | 'compliance' | 'team' | 'services';
  message: string;
}

export interface ProjectReadinessFacts {
  hasArea: boolean;
  hasCoordinates: boolean;
  hasAddress: boolean;
  hasCover: boolean;
  galleryCount: number;
  unitCount: number;
  publishableUnitCount: number;
  pricedUnitCount: number;
  ratePlanCount: number;
  complianceCredentialCount: number;
  activeRoleAssignmentCount: number;
  activeServiceCount: number;
}

export interface ProjectReadinessReport {
  ready: boolean;
  score: number;
  blockers: ReadinessFinding[];
  warnings: ReadinessFinding[];
  facts: ProjectReadinessFacts;
}

export function evaluateProjectReadiness(facts: ProjectReadinessFacts): ProjectReadinessReport {
  const findings: ReadinessFinding[] = [];
  const blocker = (code: string, area: ReadinessFinding['area'], message: string) =>
    findings.push({ code, area, message, severity: 'blocker' });
  const warning = (code: string, area: ReadinessFinding['area'], message: string) =>
    findings.push({ code, area, message, severity: 'warning' });

  if (!facts.hasArea) blocker('project.area_missing', 'location', 'Assign the project to a canonical Area.');
  if (!facts.hasCoordinates) blocker('project.coordinates_missing', 'location', 'Set valid latitude and longitude.');
  if (!facts.hasAddress) blocker('project.address_missing', 'identity', 'Add the operating address.');
  if (!facts.hasCover) blocker('project.cover_missing', 'content', 'Add a project cover image.');
  if (facts.galleryCount < 3) warning('project.gallery_thin', 'content', 'Add at least three project gallery images.');

  if (facts.unitCount < 1) blocker('inventory.no_units', 'inventory', 'Add at least one unit.');
  if (facts.publishableUnitCount < 1) blocker('inventory.no_publishable_units', 'inventory', 'Complete at least one unit for publication.');
  if (facts.unitCount > facts.publishableUnitCount) warning('inventory.incomplete_units', 'inventory', 'Some units are still missing public inventory facts.');

  if (facts.pricedUnitCount < 1 && facts.ratePlanCount < 1) blocker('pricing.no_sellable_price', 'pricing', 'Configure a unit price or canonical rate plan.');
  if (facts.ratePlanCount < 1) warning('pricing.no_rate_plan', 'pricing', 'No canonical rate plan is configured yet.');

  if (facts.complianceCredentialCount < 1) blocker('compliance.no_credentials', 'compliance', 'Attach an active, verified operating/compliance credential.');
  if (facts.activeRoleAssignmentCount < 1) blocker('team.no_operator', 'team', 'Assign at least one active operator/admin role to the property.');
  if (facts.activeServiceCount < 1) warning('services.none_enabled', 'services', 'No active services are enabled for this property.');

  const blockers = findings.filter((f) => f.severity === 'blocker');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const score = Math.max(0, Math.min(100, 100 - blockers.length * 10 - warnings.length * 3));
  return { ready: blockers.length === 0, score, blockers, warnings, facts };
}

export async function getProjectReadiness(
  db: PrismaClient,
  projectId: string
): Promise<ProjectReadinessReport> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      areaId: true,
      latitude: true,
      longitude: true,
      address: true,
      coverMediaId: true,
      galleryMedia: { select: { mediaId: true } },
      units: {
        select: {
          id: true,
          name: true,
          bedrooms: true,
          bathrooms: true,
          maxGuests: true,
          addressSupplement: true,
          coverMediaId: true,
          descriptionKey: true,
          baseNightlyThb: true,
          minNights: true,
          permittedUseConfirmedAt: true,
        },
      },
      ratePlans: { where: { status: 'active' }, select: { id: true } },
      regulatoryCredentials: {
        where: { status: 'active', verificationStatus: 'verified' },
        select: { id: true },
      },
      roleAssignments: { where: { status: 'active' }, select: { id: true } },
      serviceProjects: {
        where: { service: { status: 'active', provider: { status: 'active' } } },
        select: { service_id: true },
      },
    },
  });

  if (!project) throw new Error('Project not found');

  const publishableUnitCount = project.units.filter((unit) =>
    Boolean(
      unit.name?.trim() &&
        unit.bedrooms >= 0 &&
        unit.bathrooms >= 0 &&
        unit.maxGuests > 0 &&
        unit.addressSupplement?.trim() &&
        unit.coverMediaId &&
        unit.descriptionKey &&
        unit.minNights > 0 &&
        unit.permittedUseConfirmedAt
    )
  ).length;

  const facts: ProjectReadinessFacts = {
    hasArea: Boolean(project.areaId),
    hasCoordinates:
      Number.isFinite(Number(project.latitude)) &&
      Number.isFinite(Number(project.longitude)) &&
      !(Number(project.latitude) === 0 && Number(project.longitude) === 0),
    hasAddress: Boolean(project.address?.trim()),
    hasCover: Boolean(project.coverMediaId),
    galleryCount: project.galleryMedia.length,
    unitCount: project.units.length,
    publishableUnitCount,
    pricedUnitCount: project.units.filter((unit) => unit.baseNightlyThb > 0).length,
    ratePlanCount: project.ratePlans.length,
    complianceCredentialCount: project.regulatoryCredentials.length,
    activeRoleAssignmentCount: project.roleAssignments.length,
    activeServiceCount: project.serviceProjects.length,
  };

  return evaluateProjectReadiness(facts);
}

export async function assertProjectGoLiveReady(db: PrismaClient, projectId: string): Promise<void> {
  const report = await getProjectReadiness(db, projectId);
  if (!report.ready) {
    throw new Error(`Project is not ready for go-live: ${report.blockers.map((b) => b.code).join(', ')}`);
  }
}
