import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import { assertCatalogKeys } from '@/modules/config';
import { ProjectStatus } from '@prisma/client';
import { assertProjectReadyForActivation } from './property-readiness';
import { amenitySlug } from './project-amenities.service';

interface CreateProjectInput {
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  latitude: number;
  longitude: number;
  address: string;
  timezone?: string;
  amenityKeys?: string[];
  handbookKey?: string;
  status?: ProjectStatus;
  actorIdentityId?: string;
  areaId?: string | null;
  projectType?: string;
  developmentLifecycleStatus?: string;
  operationalStatus?: string;
  brand?: string;
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postcode?: string;
  totalUnits?: number;
  totalBuildings?: number;
  floors?: number;
  facilities?: string[];
  landAreaSqm?: number | null;
  commonAreaSqm?: number | null;
}

interface UpdateProjectInput {
  projectId: string;
  name?: string;
  areaLabelKey?: string;
  descriptionKey?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  timezone?: string;
  amenityKeys?: string[];
  handbookKey?: string;
  status?: ProjectStatus;
  coverMediaId?: string | null;
  actorIdentityId?: string;
  areaId?: string | null;
  projectType?: string | null;
  developmentLifecycleStatus?: string | null;
  operationalStatus?: string | null;
  brand?: string | null;
  country?: string;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  postcode?: string | null;
  totalUnits?: number | null;
  totalBuildings?: number | null;
  floors?: number | null;
  facilities?: string[];
  landAreaSqm?: number | null;
  commonAreaSqm?: number | null;
}

function assertValidLocation(latitude: number, longitude: number, address: string): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Project coordinates are outside the valid geographic range');
  }
  if (latitude === 0 && longitude === 0) throw new Error('Project coordinates must be verified; 0,0 is not a usable property location');
  if (!address || !address.trim()) throw new Error('Project address is required');
}

/**
 * Create a new project.
 * Admin-only action.
 */
export async function createProject(input: CreateProjectInput) {
  const {
    slug,
    name,
    areaLabelKey,
    descriptionKey,
    latitude,
    longitude,
    address,
    timezone = 'Asia/Bangkok',
    amenityKeys = [],
    handbookKey,
    status = 'draft',
    actorIdentityId,
    areaId,
    projectType,
    developmentLifecycleStatus,
    operationalStatus,
    brand,
    country = 'TH',
    region,
    city,
    district,
    subdistrict,
    postcode,
    totalUnits,
    totalBuildings,
    floors,
    facilities = [],
    landAreaSqm,
    commonAreaSqm,
  } = input;

  assertValidLocation(latitude, longitude, address);
  // Check slug uniqueness
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Project with slug "${slug}" already exists`);
  }

  // Legacy create callers may still supply simple amenity/facility arrays.
  // Validate known amenity keys, then canonicalize both arrays into
  // ProjectAmenity rows. The Project string arrays are no longer written.
  await assertCatalogKeys(prisma, 'catalog.amenities', input.amenityKeys);
  const legacyExperience = [
    ...amenityKeys.map(value => ({ value, categoryKey: 'amenity' })),
    ...facilities.map(value => ({ value, categoryKey: 'facility' })),
  ].filter(item => Boolean(item.value?.trim()));
  const dedupedExperience = Array.from(new Map(
    legacyExperience.map(item => [amenitySlug(item.value), item])
  ).entries()).filter(([slug]) => Boolean(slug));

  const project = await prisma.$transaction(async tx => {
    const created = await tx.project.create({
      data: {
      slug,
      name,
      areaLabelKey,
      descriptionKey,
      latitude,
      longitude,
      address,
      timezone,
      amenityKeys: [],
      // handbookKey is a required content-key column; default to the project's
      // conventional handbook key when the caller doesn't supply one (the
      // content itself can stay an unfilled draft).
      handbookKey: handbookKey || 'project.handbook.default',
      status,
      areaId: areaId || null,
      projectType: projectType || null,
      developmentLifecycleStatus: developmentLifecycleStatus || null,
      operationalStatus: operationalStatus || null,
      brand: brand || null,
      country,
      region: region || null,
      city: city || null,
      district: district || null,
      subdistrict: subdistrict || null,
      postcode: postcode || null,
      totalUnits: totalUnits ?? null,
      totalBuildings: totalBuildings ?? null,
      floors: floors ?? null,
      facilities: [],
      landAreaSqm: landAreaSqm ?? null,
      commonAreaSqm: commonAreaSqm ?? null,
      },
    });
    if (dedupedExperience.length) {
      await tx.projectAmenity.createMany({
        data: dedupedExperience.map(([slug, item], index) => ({
          projectId: created.id,
          slug,
          name: item.value.trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
          categoryKey: item.categoryKey,
          accessType: 'open',
          bookingRequired: false,
          bookingMode: 'none',
          pricingType: 'included',
          published: status === 'live',
          sort: index,
        })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  // Audit log
  await logAudit({
    actorIdentityId,
    action: 'projects:create',
    entityType: 'Project',
    entityId: project.id,
    data: {
      slug,
      name,
      status,
    },
  });

  return project;
}

/**
 * Get a project by ID.
 */
export async function getProject(projectId: string) {
  return await prisma.project.findUnique({
    where: { id: projectId },
  });
}

/**
 * Get a project by slug.
 */
export async function getProjectBySlug(slug: string) {
  return await prisma.project.findUnique({
    where: { slug },
  });
}

/**
 * List all projects with optional status filter.
 */
export async function listProjects(status?: ProjectStatus) {
  return await prisma.project.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a project.
 * Admin-only action.
 */
export async function updateProject(input: UpdateProjectInput) {
  const {
    projectId,
    name,
    areaLabelKey,
    descriptionKey,
    latitude,
    longitude,
    address,
    timezone,
    handbookKey,
    status,
    coverMediaId,
    actorIdentityId,
    areaId,
    projectType,
    developmentLifecycleStatus,
    operationalStatus,
    brand,
    country,
    region,
    city,
    district,
    subdistrict,
    postcode,
    totalUnits,
    totalBuildings,
    floors,
    landAreaSqm,
    commonAreaSqm,
  } = input;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  assertValidLocation(latitude ?? Number(project.latitude), longitude ?? Number(project.longitude), address ?? project.address);

  // Validate status transitions
  if (status && status !== project.status) {
    if (status === 'live' && project.status === 'draft') {
      await assertProjectReadyForActivation(prisma, projectId);
    } else if (status === 'archived' && (project.status === 'live' || project.status === 'draft')) {
      // Allow live/draft → archived
    } else if (status === project.status) {
      // No-op
    } else {
      throw new Error(
        `Invalid status transition: ${project.status} → ${status}`
      );
    }
  }

  // Project-level amenities/facilities have one authority: ProjectAmenity.
  // Reject legacy array writes so a second source of truth cannot reappear.
  if (input.amenityKeys !== undefined || input.facilities !== undefined) {
    throw new Error('Project amenities and facilities must be managed in Project Experience');
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined && { name }),
      ...(areaLabelKey !== undefined && { areaLabelKey }),
      ...(descriptionKey !== undefined && { descriptionKey }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(address !== undefined && { address }),
      ...(timezone !== undefined && { timezone }),
       ...(handbookKey !== undefined && { handbookKey: (handbookKey || null) as any }),
      ...(status !== undefined && { status }),
      ...(coverMediaId !== undefined && { coverMediaId }),
      ...(areaId !== undefined && { areaId }),
      ...(projectType !== undefined && { projectType }),
      ...(developmentLifecycleStatus !== undefined && { developmentLifecycleStatus }),
      ...(operationalStatus !== undefined && { operationalStatus }),
      ...(brand !== undefined && { brand }),
      ...(country !== undefined && { country }),
      ...(region !== undefined && { region }),
      ...(city !== undefined && { city }),
      ...(district !== undefined && { district }),
      ...(subdistrict !== undefined && { subdistrict }),
      ...(postcode !== undefined && { postcode }),
      ...(totalUnits !== undefined && { totalUnits }),
      ...(totalBuildings !== undefined && { totalBuildings }),
      ...(floors !== undefined && { floors }),
       ...(landAreaSqm !== undefined && { landAreaSqm }),
      ...(commonAreaSqm !== undefined && { commonAreaSqm }),
    } as any,
  });

  // Audit log
  await logAudit({
    actorIdentityId,
    action: 'projects:update',
    entityType: 'Project',
    entityId: projectId,
    data: {
      before: project,
      after: updated,
    } as any,
  });

  return updated;
}

/**
 * Get project with related data (units, engagements, etc.).
 */
export async function getProjectDetail(projectId: string) {
  return await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      units: {
        include: {
          owner: true,
          engagements: {
            where: { status: 'active' },
            take: 1,
          },
        },
      },
    },
  });
}
