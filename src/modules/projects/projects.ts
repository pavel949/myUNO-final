import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import { ProjectStatus } from '@prisma/client';

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
  } = input;

  // Check slug uniqueness
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Project with slug "${slug}" already exists`);
  }

  const project = await prisma.project.create({
    data: {
      slug,
      name,
      areaLabelKey,
      descriptionKey,
      latitude,
      longitude,
      address,
      timezone,
      amenityKeys,
      // handbookKey is a required content-key column; default to the project's
      // conventional handbook key when the caller doesn't supply one (the
      // content itself can stay an unfilled draft).
      handbookKey: handbookKey || 'project.handbook.default',
      status,
      defaultCurrency: 'THB',
    },
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
    amenityKeys,
    handbookKey,
    status,
    coverMediaId,
    actorIdentityId,
  } = input;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Validate status transitions
  if (status && status !== project.status) {
    if (status === 'live' && project.status === 'draft') {
      // Allow draft → live
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
      ...(amenityKeys !== undefined && { amenityKeys }),
      ...(handbookKey !== undefined && { handbookKey: (handbookKey || null) as any }),
      ...(status !== undefined && { status }),
      ...(coverMediaId !== undefined && { coverMediaId }),
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
