import { PrismaClient, RoleType } from '@prisma/client';
import { createNotification } from '@/modules/comms';

export interface CreateProviderApplicationInput {
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  categoryKeys: string[];
  /** The identity submitting the application (F-PROV-1) — receives the
   *  provider_member role and the vetting-outcome notifications. */
  applicantIdentityId: string;
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
  const {
    name,
    description,
    contactEmail,
    contactPhone,
    categoryKeys,
    applicantIdentityId,
  } = input;

  const provider = await db.provider.create({
    data: {
      name,
      description,
      contactEmail,
      contactPhone,
      categoryKeys,
      status: 'applied',
      applicant_identity_id: applicantIdentityId,
    },
  });

  return {
    id: provider.id,
    identityId: applicantIdentityId,
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

  // The applicant becomes the provider's first member (multi-member invites
  // are post-loop-one). Legacy applications without an applicant get no role —
  // the admin assigns one manually.
  if (provider.applicant_identity_id) {
    await db.roleAssignment.create({
      data: {
        identityId: provider.applicant_identity_id,
        role: 'provider_member' as RoleType,
        scopeType: 'platform',
        providerId,
        status: 'active',
        grantedByIdentityId: approvedByIdentityId,
      },
    });
  }

  // Send N-18 to the applicant (the vetting outcome is theirs, not the approver's)
  if (provider.applicant_identity_id) {
    try {
      await createNotification(db, {
        identityId: provider.applicant_identity_id,
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
  _rejectedByIdentityId: string,
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

  // Send N-19 to the applicant with the rejection reason
  if (provider.applicant_identity_id) {
    try {
      await createNotification(db, {
        identityId: provider.applicant_identity_id,
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
}

/**
 * The provider record an identity is attached to: their active membership's
 * provider if they have one, else their latest application (so an applicant
 * can watch their own vetting status before any role exists).
 */
export async function getProviderForIdentity(
  db: PrismaClient,
  identityId: string
): Promise<{
  id: string;
  name: string;
  status: string;
  categoryKeys: string[];
  isMember: boolean;
} | null> {
  const membership = await db.roleAssignment.findFirst({
    where: { identityId, role: 'provider_member', status: 'active' },
    select: { providerId: true },
  });
  const provider = membership?.providerId
    ? await db.provider.findUnique({ where: { id: membership.providerId } })
    : await db.provider.findFirst({
        where: { applicant_identity_id: identityId },
        orderBy: { createdAt: 'desc' },
      });
  if (!provider) return null;
  return {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    categoryKeys: provider.categoryKeys,
    isMember: Boolean(membership?.providerId),
  };
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
