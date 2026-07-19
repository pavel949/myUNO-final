import { PrismaClient, ServiceStatus } from '@prisma/client';
import { getConfig } from '@/modules/config';

export interface CreateServiceInput {
  providerId: string;
  categoryKey: string;
  title: string;
  description?: string;
  titleRu?: string;
  titleEn?: string;
  titleTh?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  descriptionTh?: string;
  priceModel: 'fixed' | 'per_hour' | 'per_person' | 'quote';
  basePriceThb?: number;
  durationMin?: number;
  fulfilmentMode?: 'referred' | 'operated';
  advanceNoticeHours?: number;
  availableProjectIds?: string[];
}

export interface UpdateServiceInput {
  title?: string;
  description?: string;
  titleRu?: string;
  titleEn?: string;
  titleTh?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  descriptionTh?: string;
  basePriceThb?: number;
  durationMin?: number;
  advanceNoticeHours?: number;
  status?: ServiceStatus;
}

/**
 * Create a new service (draft or active depending on admin approval config).
 */
export async function createService(
  db: PrismaClient,
  input: CreateServiceInput
): Promise<{ id: string }> {
  const {
    providerId,
    categoryKey,
    title,
    description,
    titleRu,
    titleEn,
    titleTh,
    descriptionRu,
    descriptionEn,
    descriptionTh,
    priceModel,
    basePriceThb,
    durationMin,
    fulfilmentMode = 'referred',
    advanceNoticeHours = 0,
    availableProjectIds = [],
  } = input;

  // Check if admin approval is required
  const requiresApproval = await getConfig(db, 'services.require_admin_approval');
  const status = requiresApproval !== false ? 'draft' : 'active';

  const service = await db.service.create({
    data: {
      provider_id: providerId,
      categoryKey,
      title,
      description,
      titleRu,
      titleEn,
      titleTh,
      descriptionRu,
      descriptionEn,
      descriptionTh,
      priceModel: priceModel as any,
      basePriceThb,
      durationMin,
      fulfilmentMode: fulfilmentMode as any,
      advanceNoticeHours,
      status: status as any,
    },
  });

  // Add to available projects if specified
  if (availableProjectIds.length > 0) {
    await db.serviceProject.createMany({
      data: availableProjectIds.map((projectId) => ({
        service_id: service.id,
        project_id: projectId,
      })),
    });
  }

  return { id: service.id };
}

/**
 * Get a single service by ID.
 */
export async function getService(db: PrismaClient, serviceId: string): Promise<any> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          status: true,
          vetted_at: true,
        },
      },
      availableProjects: {
        select: { project_id: true },
      },
    },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  return {
    ...service,
    availableProjectIds: service.availableProjects.map((p) => p.project_id),
  };
}

/**
 * Update a service (draft only).
 */
export async function updateService(
  db: PrismaClient,
  serviceId: string,
  input: UpdateServiceInput
): Promise<void> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  // Only draft services can be edited
  if (service.status !== 'draft') {
    throw new Error('Cannot edit active or paused services');
  }

  await db.service.update({
    where: { id: serviceId },
    data: input,
  });
}

/**
 * Get all services by provider, with optional status filter.
 */
export async function getServicesByProvider(
  db: PrismaClient,
  providerId: string,
  filters?: { status?: ServiceStatus }
): Promise<any[]> {
  const services = await db.service.findMany({
    where: {
      provider_id: providerId,
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          status: true,
          vetted_at: true,
        },
      },
      availableProjects: {
        select: { project_id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return services.map((s) => ({
    ...s,
    availableProjectIds: s.availableProjects.map((p) => p.project_id),
  }));
}

/**
 * Get all active services visible in a project context.
 * Services are visible if:
 * - Status is active
 * - Provider is active (vetted)
 * - Service has no project restrictions OR project is in availableProjects
 */
export async function listPublicServices(
  db: PrismaClient,
  projectId: string,
  filters?: { categoryKey?: string }
): Promise<any[]> {
  const services = await db.service.findMany({
    where: {
      status: 'active',
      provider: {
        status: 'active',
        vetted_at: { not: null },
      },
      OR: [
        // No project restrictions
        {
          availableProjects: {
            none: {},
          },
        },
        // Project is in available projects
        {
          availableProjects: {
            some: {
              project_id: projectId,
            },
          },
        },
      ],
      ...(filters?.categoryKey && { categoryKey: filters.categoryKey }),
    },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          description: true,
          logoMediaId: true,
          status: true,
          vetted_at: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return services.map((s) => ({
    ...s,
    isVetted: s.provider.vetted_at !== null,
  }));
}

/**
 * Approve a service (draft → active).
 * Called by admin after spot-check.
 */
export async function approveService(
  db: PrismaClient,
  serviceId: string,
  _approvedByIdentityId: string
): Promise<void> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (service.status !== 'draft') {
    throw new Error('Only draft services can be approved');
  }

  await db.service.update({
    where: { id: serviceId },
    data: { status: 'active' },
  });
}

/**
 * Reject a service (draft → paused).
 * Called by admin to decline a service without deleting it.
 */
export async function rejectService(
  db: PrismaClient,
  serviceId: string,
  _rejectedByIdentityId: string,
  _reason?: string
): Promise<void> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (service.status !== 'draft') {
    throw new Error('Only draft services can be rejected');
  }

  await db.service.update({
    where: { id: serviceId },
    data: { status: 'paused' },
  });
}

/**
 * Get the average rating for a service across all its fulfilled orders.
 * Returns { averageRating, reviewCount } or null if no reviews exist.
 */
export async function getServiceAverageRating(
  db: PrismaClient,
  serviceId: string
): Promise<{ averageRating: number; reviewCount: number } | null> {
  // Get all order IDs for this service
  const orders = await db.serviceOrder.findMany({
    where: { service_id: serviceId },
    select: { id: true },
  });

  if (orders.length === 0) {
    return null;
  }

  const orderIds = orders.map((o) => o.id);

  // Get all reviews for these orders (only published)
  const reviews = await db.review.findMany({
    where: {
      target_type: 'service_order',
      target_id: { in: orderIds },
      status: 'published',
    },
  });

  if (reviews.length === 0) {
    return null;
  }

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const averageRating = Math.round((sum / reviews.length) * 10) / 10;

  return {
    averageRating,
    reviewCount: reviews.length,
  };
}
