import { PrismaClient, AnnouncementAudience, AnnouncementPostedAs, RoleType } from '@prisma/client';
import { createNotification } from './comms.service';
import { track } from '@/modules/analytics';

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

/** Who an announcement is signed by, and on whose behalf. */
export interface PostingAuthority {
  postedAs: AnnouncementPostedAs;
  organizationId: string | null;
}

/**
 * Work out, from the roles a person actually holds on this project, the voice
 * they are allowed to post in.
 *
 * This must never be taken from the request. `postedAs` is the signature on a
 * project-wide broadcast: a staff member who could send it as
 * `juristic_person` would be putting words in the mouth of the legal body that
 * governs the building. CLAUDE.md is explicit that announcements come from
 * myUNO or the juristic person / management company, and which of the three it
 * is follows from the role, not from a form field.
 *
 * Throws with `code: 'NOT_AUTHORIZED'` when the person has no voice here at all.
 */
export async function resolvePostingAuthority(
  db: PrismaClient,
  identityId: string,
  projectId: string,
  isAdmin: boolean
): Promise<PostingAuthority> {
  if (isAdmin) return { postedAs: 'myuno', organizationId: null };

  const assignments = await db.roleAssignment.findMany({
    where: {
      identityId,
      status: 'active',
      role: { in: ['staff_ops', 'mc_member', 'juristic_member'] },
      // Platform-scoped staff post anywhere; everyone else must hold the role
      // on this project. A management-company member for one building has no
      // standing in another.
      OR: [{ projectId }, { projectId: null, scopeType: 'platform' }],
    },
  });

  const staff = assignments.find((a) => a.role === 'staff_ops');
  if (staff) return { postedAs: 'myuno', organizationId: null };

  const mc = assignments.find((a) => a.role === 'mc_member');
  if (mc) return { postedAs: 'management_company', organizationId: mc.organizationId };

  const juristic = assignments.find((a) => a.role === 'juristic_member');
  if (juristic) return { postedAs: 'juristic_person', organizationId: juristic.organizationId };

  const error = new Error('You cannot post announcements for this project');
  (error as { code?: string }).code = 'NOT_AUTHORIZED';
  throw error;
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
  identityId: string,
  isAdmin = false
): Promise<void> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
    include: { project: true },
  });

  if (!announcement) {
    throw new Error(`Announcement ${announcementId} not found`);
  }

  // The creator, or an admin. The admin arm used to be a TODO, which meant a
  // draft written by someone who had since left could never be published or
  // withdrawn by anyone.
  const creator = announcement.createdByIdentityId === identityId;
  if (!creator && !isAdmin) {
    const error = new Error('Not authorized to publish this announcement');
    (error as { code?: string }).code = 'NOT_AUTHORIZED';
    throw error;
  }

  // Publishing twice would notify the whole project twice.
  if (announcement.status === 'published') {
    const error = new Error('This announcement is already published');
    (error as { code?: string }).code = 'ALREADY_PUBLISHED';
    throw error;
  }

  // Update status to published
  await db.announcement.update({
    where: { id: announcementId },
    data: { status: 'published' },
  });

  // Track analytics event for announcement published
  await track(db, 'announcement_published', {
    projectId: announcement.projectId,
    identityId: announcement.createdByIdentityId,
    audience: announcement.audience,
    announcementId: announcement.id,
  }).catch(() => null);

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
  identityId: string,
  options?: {
    /**
     * Audiences the caller knows apply to this viewer for a reason that is not
     * a role row. The in-stay home space passes `guests_in_stay`: a guest's
     * membership of that audience comes from having a booking here right now,
     * and booking has never written a `guest` RoleAssignment.
     */
    alsoInclude?: AnnouncementAudience[];
  }
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
  const alsoInclude = new Set(options?.alsoInclude ?? []);
  return announcements
    .filter((a) => alsoInclude.has(a.audience) || audienceMatches(a.audience, userRoles))
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

  // Check if this is a new read (doesn't exist yet)
  const existingRead = await db.announcementRead.findUnique({
    where: {
      announcementId_identityId: {
        announcementId,
        identityId,
      },
    },
  });

  const isNewRead = !existingRead;

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

  // Track analytics event for announcement read (only on first read)
  if (isNewRead) {
    await track(db, 'announcement_read', {
      projectId: announcement.projectId,
      identityId,
      announcementId,
    }).catch(() => null);
  }
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
  const recipients = new Set<string>();

  const addRoles = async (roles: RoleType[] | undefined) => {
    const assignments = await db.roleAssignment.findMany({
      where: {
        projectId,
        status: 'active',
        ...(roles ? { role: { in: roles } } : {}),
      },
      select: { identityId: true },
      distinct: ['identityId'],
    });
    for (const a of assignments) recipients.add(a.identityId);
  };

  const addGuestsInStay = async () => {
    for (const g of await inStayGuestIdentityIds(db, projectId)) recipients.add(g);
  };

  switch (audience) {
    case 'everyone':
      await addRoles(undefined);
      // A guest staying in the building right now is unmistakably part of
      // "everyone", and without this they were the one group a project-wide
      // announcement never reached.
      await addGuestsInStay();
      break;
    case 'owners':
      await addRoles(['owner']);
      break;
    case 'residents':
      await addRoles(['resident']);
      break;
    case 'guests_in_stay':
      // Deliberately *not* a role lookup. Booking has never written a `guest`
      // RoleAssignment, so filtering on one sent this audience to nobody at
      // all — the announcement published, notified zero people, and looked
      // successful. Membership here is having a stay in progress.
      await addGuestsInStay();
      break;
    case 'staff':
      await addRoles(['staff_ops', 'onsite_host']);
      break;
  }

  return [...recipients];
}

/**
 * Everyone whose stay in this project is under way: checked in, or confirmed
 * with today inside the dates. Compared on the date alone because a stay's
 * dates are dates, not instants.
 */
export async function inStayGuestIdentityIds(
  db: PrismaClient,
  projectId: string,
  now: Date = new Date()
): Promise<string[]> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const bookings = await db.booking.findMany({
    where: {
      projectId,
      OR: [
        { status: 'checked_in' },
        { status: 'confirmed', startDate: { lte: today }, endDate: { gte: today } },
      ],
    },
    select: { guestIdentityId: true },
    distinct: ['guestIdentityId'],
  });

  return bookings.map((b) => b.guestIdentityId);
}
