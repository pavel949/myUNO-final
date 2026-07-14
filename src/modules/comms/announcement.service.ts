import { PrismaClient, AnnouncementAudience, AnnouncementPostedAs, RoleType } from '@prisma/client';
import { createNotification } from './comms.service';

export interface CreateAnnouncementInput {
  projectId: string;
  createdByIdentityId: string;
  organizationId?: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  postedAs: AnnouncementPostedAs;
  isPinned?: boolean;
  isImportant?: boolean;
  expiresAt?: Date;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  audience?: AnnouncementAudience;
  isPinned?: boolean;
  isImportant?: boolean;
  expiresAt?: Date | null;
}

/**
 * Create a draft announcement.
 * Admin/staff post as myuno; mc_member as management_company; juristic_member as juristic_person.
 */
export async function createAnnouncement(
  db: PrismaClient,
  input: CreateAnnouncementInput
): Promise<{ id: string }> {
  const {
    projectId,
    createdByIdentityId,
    organizationId,
    title,
    body,
    audience,
    postedAs,
    isPinned = false,
    isImportant = false,
    expiresAt,
  } = input;

  const announcement = await db.announcement.create({
    data: {
      projectId,
      createdByIdentityId,
      organizationId,
      title,
      body,
      audience,
      postedAs,
      isPinned,
      isImportant,
      expiresAt,
      status: 'draft',
    },
  });

  return { id: announcement.id };
}

/**
 * Publish an announcement (draft → published).
 * Sends N-32 notifications to audience members.
 */
export async function publishAnnouncement(
  db: PrismaClient,
  announcementId: string,
  identityId: string
): Promise<void> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
    include: { project: true },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // Permission check: creator or admin can publish
  const creator = announcement.createdByIdentityId === identityId;
  if (!creator) {
    // TODO: Check if admin (once core.can() is ready)
    throw new Error('Not authorized to publish this announcement');
  }

  // Update status to published
  await db.announcement.update({
    where: { id: announcementId },
    data: { status: 'published' },
  });

  // Fetch all identities who should receive the notification based on audience
  const recipientIds = await getAudienceIdentities(
    db,
    announcement.projectId,
    announcement.audience
  );

  // Send N-32 notifications to audience members (best-effort)
  for (const recipientId of recipientIds) {
    try {
      await createNotification(db, {
        identityId: recipientId,
        type: 'announcement_published',
        titleKey: 'notify.announcement_published.title',
        bodyKey: 'notify.announcement_published.body',
        params: {
          title: announcement.title,
        },
        channels: announcement.isImportant ? ['in_app', 'email'] : ['in_app'],
      });
    } catch (err) {
      // Best-effort: log and continue
      console.error(`Failed to notify ${recipientId} of announcement`, err);
    }
  }
}

/**
 * Unpublish an announcement (published → unpublished).
 * Only the creator (if org) or admin can unpublish.
 */
export async function unpublishAnnouncement(
  db: PrismaClient,
  announcementId: string,
  identityId: string,
  isAdmin: boolean
): Promise<void> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // Permission check: creator-org or admin
  const canUnpublish =
    isAdmin || (announcement.createdByIdentityId === identityId && announcement.organizationId);

  if (!canUnpublish) {
    throw new Error('Not authorized to unpublish this announcement');
  }

  await db.announcement.update({
    where: { id: announcementId },
    data: { status: 'unpublished' },
  });
}

/**
 * Update an announcement (draft only).
 */
export async function updateAnnouncement(
  db: PrismaClient,
  announcementId: string,
  identityId: string,
  input: UpdateAnnouncementInput
): Promise<void> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // Only draft announcements can be edited
  if (announcement.status !== 'draft') {
    throw new Error('Cannot edit published or unpublished announcements');
  }

  // Permission check: creator only
  if (announcement.createdByIdentityId !== identityId) {
    throw new Error('Not authorized to edit this announcement');
  }

  await db.announcement.update({
    where: { id: announcementId },
    data: input,
  });
}

/**
 * Delete an announcement (draft only).
 */
export async function deleteAnnouncement(
  db: PrismaClient,
  announcementId: string,
  identityId: string
): Promise<void> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // Only draft announcements can be deleted
  if (announcement.status !== 'draft') {
    throw new Error('Cannot delete published or unpublished announcements');
  }

  // Permission check: creator only
  if (announcement.createdByIdentityId !== identityId) {
    throw new Error('Not authorized to delete this announcement');
  }

  await db.announcement.delete({
    where: { id: announcementId },
  });
}

/**
 * Get announcements visible to an identity in a project.
 * Filters by audience role(s) and marks read status.
 */
export async function getProjectAnnouncements(
  db: PrismaClient,
  projectId: string,
  identityId: string
): Promise<any[]> {
  // Get the identity's roles in this project
  const roleAssignments = await db.roleAssignment.findMany({
    where: {
      identityId,
      projectId,
      status: 'active',
    },
  });

  const userRoles = roleAssignments.map((r) => r.role as RoleType);

  // Get all published announcements for the project
  const announcements = await db.announcement.findMany({
    where: {
      projectId,
      status: 'published',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      reads: {
        where: { identityId },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      organization: {
        select: { id: true, name: true, orgType: true },
      },
    },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  // Filter by audience and return with read status
  return announcements
    .filter((a) => audienceMatches(a.audience, userRoles))
    .map((a) => ({
      ...a,
      isRead: a.reads.length > 0,
      reads: undefined, // Don't return raw reads data
    }));
}

/**
 * Mark an announcement as read by an identity.
 */
export async function markAnnouncementRead(
  db: PrismaClient,
  announcementId: string,
  identityId: string
): Promise<void> {
  // Check announcement exists
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // Upsert read record (idempotent)
  await db.announcementRead.upsert({
    where: {
      announcementId_identityId: {
        announcementId,
        identityId,
      },
    },
    create: {
      announcementId,
      identityId,
    },
    update: {}, // No-op if exists
  });
}

/**
 * Get unread announcement count for an identity in a project.
 */
export async function getUnreadCount(
  db: PrismaClient,
  projectId: string,
  identityId: string
): Promise<number> {
  // Get user roles
  const roleAssignments = await db.roleAssignment.findMany({
    where: {
      identityId,
      projectId,
      status: 'active',
    },
  });

  const userRoles = roleAssignments.map((r) => r.role as RoleType);

  // Count published announcements not yet read
  const announcements = await db.announcement.findMany({
    where: {
      projectId,
      status: 'published',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      reads: {
        where: { identityId },
      },
    },
  });

  return announcements.filter(
    (a) => audienceMatches(a.audience, userRoles) && a.reads.length === 0
  ).length;
}

/**
 * Helper: determine if an identity (by roles) matches announcement audience.
 */
function audienceMatches(audience: AnnouncementAudience, userRoles: RoleType[]): boolean {
  switch (audience) {
    case 'everyone':
      return true;
    case 'owners':
      return userRoles.includes('owner');
    case 'residents':
      return userRoles.includes('resident');
    case 'guests_in_stay':
      return userRoles.includes('guest');
    case 'staff':
      return userRoles.includes('staff_ops') || userRoles.includes('onsite_host');
    default:
      return false;
  }
}

/**
 * Helper: fetch all identities who should receive a notification based on audience.
 * Returns identity IDs that match the audience role(s).
 */
async function getAudienceIdentities(
  db: PrismaClient,
  projectId: string,
  audience: AnnouncementAudience
): Promise<string[]> {
  let roleFilter: RoleType[];

  switch (audience) {
    case 'everyone':
      // All active roles in project
      const allRoles = await db.roleAssignment.findMany({
        where: {
          projectId,
          status: 'active',
        },
        select: { identityId: true },
        distinct: ['identityId'],
      });
      return allRoles.map((r) => r.identityId);

    case 'owners':
      roleFilter = ['owner'];
      break;
    case 'residents':
      roleFilter = ['resident'];
      break;
    case 'guests_in_stay':
      roleFilter = ['guest'];
      break;
    case 'staff':
      roleFilter = ['staff_ops', 'onsite_host'];
      break;
  }

  const roles = await db.roleAssignment.findMany({
    where: {
      projectId,
      role: { in: roleFilter },
      status: 'active',
    },
    select: { identityId: true },
    distinct: ['identityId'],
  });

  return roles.map((r) => r.identityId);
}
