import { PrismaClient, RoleType } from '@prisma/client';
import { createNotification } from '@/modules/comms';

export interface CreateProviderApplicationInput {
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  categoryKeys: string[];
}

export interface ApproveProviderInput {
  providerId: string;
  approvedByIdentityId: string;
}

export interface RejectProviderInput {
  providerId: string;
  rejectedByIdentityId: string;
  reason?: string;
}

/**
 * Create a new provider application (status=applied).
 */
export async function createProviderApplication(
  db: PrismaClient,
  input: CreateProviderApplicationInput
): Promise<{ id: string; identityId: string }> {
  const { name, description, contactEmail, contactPhone, categoryKeys } = input;

  const provider = await db.provider.create({
    data: {
      name,
      description,
      contactEmail,
      contactPhone,
      categoryKeys,
      status: 'applied',
    },
  });

  return {
    id: provider.id,
    identityId: '', // Placeholder; in production this would link to an applicant identity
  };
}

/**
 * Get all providers filtered by status (for admin vetting queue).
 */
export async function getProviderApplications(
  db: PrismaClient,
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  const { status = 'applied', limit = 50, offset = 0 } = filters || {};

  const providers = await db.provider.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      vetted_by: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });

  return providers;
}

/**
 * Approve a provider application (status: applied/vetting → active).
 * Sets vetted_at and creates provider_member role.
 * Sends N-18 notification.
 */
export async function approveProvider(
  db: PrismaClient,
  providerId: string,
  approvedByIdentityId: string
): Promise<void> {
  const provider = await db.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  // Update provider to active and set vetted metadata
  await db.provider.update({
    where: { id: providerId },
    data: {
      status: 'active',
      vetted_at: new Date(),
      vetted_by_identity_id: approvedByIdentityId,
    },
  });

  // Create provider_member role for the provider (for first staff member).
  // In production, this would be done via a separate staff management flow.
  // For now, we create a role pointing to the approver's identity as a placeholder.
  await db.roleAssignment.create({
    data: {
      identityId: approvedByIdentityId,
      role: 'provider_member' as RoleType,
      scopeType: 'platform',
      providerId,
      status: 'active',
      grantedByIdentityId: approvedByIdentityId,
    },
  });

  // Send N-18 notification
  try {
    await createNotification(db, {
      identityId: approvedByIdentityId,
      type: 'provider_approved',
      titleKey: 'notify.provider_approved.title',
      bodyKey: 'notify.provider_approved.body',
      params: {
        name: provider.name,
      },
      channels: ['in_app', 'email'],
    });
  } catch (err) {
    console.error(`Failed to send approval notification for provider ${providerId}`, err);
  }
}

/**
 * Reject a provider application.
 * Sets status to rejected and sends N-19 notification.
 * Note: "rejected" status is not in the schema; this transitions to 'offboarded' instead.
 * For loop one, we treat rejection as a soft transition.
 */
export async function rejectProvider(
  db: PrismaClient,
  providerId: string,
  rejectedByIdentityId: string,
  reason?: string
): Promise<void> {
  const provider = await db.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  // Update provider status to offboarded (rejection fallback in schema)
  await db.provider.update({
    where: { id: providerId },
    data: {
      status: 'offboarded',
    },
  });

  // Send N-19 notification with rejection reason
  try {
    await createNotification(db, {
      identityId: rejectedByIdentityId,
      type: 'provider_rejected',
      titleKey: 'notify.provider_rejected.title',
      bodyKey: 'notify.provider_rejected.body',
      params: {
        name: provider.name,
        reason: reason || 'Application does not meet our criteria',
      },
      channels: ['in_app', 'email'],
    });
  } catch (err) {
    console.error(`Failed to send rejection notification for provider ${providerId}`, err);
  }
}

/**
 * Get a single provider by ID.
 */
export async function getProvider(db: PrismaClient, providerId: string): Promise<any> {
  const provider = await db.provider.findUnique({
    where: { id: providerId },
    include: {
      vetted_by: {
        select: { id: true, firstName: true, lastName: true },
      },
      roleAssignments: {
        where: { status: 'active' },
        include: {
          identity: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      services: {
        where: { status: 'active' },
      },
    },
  });

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  return {
    ...provider,
    isVetted: provider.vetted_at !== null,
  };
}
