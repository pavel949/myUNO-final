import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createOrganization } from '@/test/util';
import * as announcementService from './announcement.service';

describe('announcement.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('createAnnouncement', () => {
    it('creates a draft announcement', async () => {
      const project = await createProject();
      const staff = await createIdentity();

      const result = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: staff.id,
        title: 'Welcome to the project',
        body: 'Please read our house rules.',
        audience: 'everyone',
        postedAs: 'myuno',
      });

      expect(result.id).toBeDefined();

      const announcement = await db.announcement.findUnique({
        where: { id: result.id },
      });

      expect(announcement?.title).toBe('Welcome to the project');
      expect(announcement?.status).toBe('draft');
      expect(announcement?.audience).toBe('everyone');
      expect(announcement?.postedAs).toBe('myuno');
    });
  });

  describe('publishAnnouncement', () => {
    it('publishes an announcement and sends notifications', async () => {
      const project = await createProject();
      const staff = await createIdentity();
      const owner = await createIdentity();

      // Create announcement as staff
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: staff.id,
        title: 'Important notice',
        body: 'New parking rules effective next week.',
        audience: 'owners',
        postedAs: 'myuno',
      });

      // Grant owner role to the owner identity
      await db.roleAssignment.create({
        data: {
          identityId: owner.id,
          projectId: project.id,
          role: 'owner',
          scopeType: 'project',
          status: 'active',
        },
      });

      // Publish
      await announcementService.publishAnnouncement(db, announcementId, staff.id);

      const announcement = await db.announcement.findUnique({
        where: { id: announcementId },
      });

      expect(announcement?.status).toBe('published');

      // Verify notification was created for owner
      const notification = await db.notification.findFirst({
        where: {
          type: 'announcement_published',
          recipientIdentityId: owner.id,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.type).toBe('announcement_published');
    });

    it('only creator can publish', async () => {
      const project = await createProject();
      const staff1 = await createIdentity();
      const staff2 = await createIdentity();

      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: staff1.id,
        title: 'Notice',
        body: 'Content',
        audience: 'everyone',
        postedAs: 'myuno',
      });

      // Try to publish as different staff
      await expect(
        announcementService.publishAnnouncement(db, announcementId, staff2.id)
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('getProjectAnnouncements — audience filtering', () => {
    it('owners see owners-only announcements', async () => {
      const project = await createProject();
      const ownerIdentity = await createIdentity();
      const admin = await createIdentity();
      await db.identity.update({
        where: { id: admin.id },
        data: { isAdmin: true },
      });

      // Owner role
      await db.roleAssignment.create({
        data: {
          identityId: ownerIdentity.id,
          projectId: project.id,
          role: 'owner',
          scopeType: 'project',
          status: 'active',
        },
      });

      // Create and publish owners-only announcement
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: admin.id,
        title: 'Owner financial report',
        body: 'Your Q3 earnings',
        audience: 'owners',
        postedAs: 'myuno',
      });

      await announcementService.publishAnnouncement(db, announcementId, admin.id);

      const ownerAnnouncements = await announcementService.getProjectAnnouncements(
        db,
        project.id,
        ownerIdentity.id
      );

      expect(ownerAnnouncements).toHaveLength(1);
      expect(ownerAnnouncements[0]?.title).toBe('Owner financial report');
    });

    it('guests do not see owners-only announcements', async () => {
      const project = await createProject();
      const guestIdentity = await createIdentity();
      const admin = await createIdentity();
      await db.identity.update({
        where: { id: admin.id },
        data: { isAdmin: true },
      });

      // Guest role
      await db.roleAssignment.create({
        data: {
          identityId: guestIdentity.id,
          projectId: project.id,
          role: 'guest',
          scopeType: 'project',
          status: 'active',
        },
      });

      // Create and publish owners-only announcement
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: admin.id,
        title: 'Owner financial report',
        body: 'Your Q3 earnings',
        audience: 'owners',
        postedAs: 'myuno',
      });

      await announcementService.publishAnnouncement(db, announcementId, admin.id);

      const guestAnnouncements = await announcementService.getProjectAnnouncements(
        db,
        project.id,
        guestIdentity.id
      );

      expect(guestAnnouncements).toHaveLength(0);
    });

    it('everyone sees everyone announcements', async () => {
      const project = await createProject();
      const guest = await createIdentity();
      const owner = await createIdentity();
      const admin = await createIdentity();
      await db.identity.update({
        where: { id: admin.id },
        data: { isAdmin: true },
      });

      // Create roles
      await db.roleAssignment.create({
        data: {
          identityId: guest.id,
          projectId: project.id,
          role: 'guest',
          scopeType: 'project',
          status: 'active',
        },
      });

      await db.roleAssignment.create({
        data: {
          identityId: owner.id,
          projectId: project.id,
          role: 'owner',
          scopeType: 'project',
          status: 'active',
        },
      });

      // Create and publish everyone announcement
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: admin.id,
        title: 'House rules',
        body: 'Please follow these rules',
        audience: 'everyone',
        postedAs: 'myuno',
      });

      await announcementService.publishAnnouncement(db, announcementId, admin.id);

      const guestAnnouncements = await announcementService.getProjectAnnouncements(
        db,
        project.id,
        guest.id
      );

      const ownerAnnouncements = await announcementService.getProjectAnnouncements(
        db,
        project.id,
        owner.id
      );

      expect(guestAnnouncements).toHaveLength(1);
      expect(ownerAnnouncements).toHaveLength(1);
    });
  });

  describe('Juristic member posting', () => {
    it('juristic member can post as their org only', async () => {
      const project = await createProject();
      const juristicMember = await createIdentity();
      const otherOrg = await createOrganization('other_org', project.id);
      const juristicOrg = await db.organization.create({
        data: {
          name: 'Juristic Person A',
          orgType: 'juristic_person',
          projectId: project.id,
          contactEmail: 'juristic@example.com',
          contactPhone: '123456789',
        },
      });

      // Grant juristic member role
      await db.roleAssignment.create({
        data: {
          identityId: juristicMember.id,
          projectId: project.id,
          role: 'juristic_member',
          organizationId: juristicOrg.id,
          scopeType: 'project',
          status: 'active',
        },
      });

      // Create announcement as this org
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: juristicMember.id,
        organizationId: juristicOrg.id,
        title: 'Legal notice',
        body: 'From the juristic person',
        audience: 'everyone',
        postedAs: 'juristic_person',
      });

      const announcement = await db.announcement.findUnique({
        where: { id: announcementId },
      });

      expect(announcement?.postedAs).toBe('juristic_person');
      expect(announcement?.organizationId).toBe(juristicOrg.id);
    });
  });

  describe('markAnnouncementRead', () => {
    it('marks announcement as read', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const admin = await createIdentity();
      await db.identity.update({
        where: { id: admin.id },
        data: { isAdmin: true },
      });

      // Owner role
      await db.roleAssignment.create({
        data: {
          identityId: owner.id,
          projectId: project.id,
          role: 'owner',
          scopeType: 'project',
          status: 'active',
        },
      });

      // Create and publish
      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: admin.id,
        title: 'Test',
        body: 'Content',
        audience: 'owners',
        postedAs: 'myuno',
      });

      await announcementService.publishAnnouncement(db, announcementId, admin.id);

      // Check unread
      let unreadCount = await announcementService.getUnreadCount(db, project.id, owner.id);
      expect(unreadCount).toBe(1);

      // Mark as read
      await announcementService.markAnnouncementRead(db, announcementId, owner.id);

      // Check read
      const announcements = await announcementService.getProjectAnnouncements(
        db,
        project.id,
        owner.id
      );

      expect(announcements[0]?.isRead).toBe(true);

      // Unread count should be 0
      unreadCount = await announcementService.getUnreadCount(db, project.id, owner.id);
      expect(unreadCount).toBe(0);
    });
  });

  describe('updateAnnouncement', () => {
    it('updates draft announcement only', async () => {
      const project = await createProject();
      const staff = await createIdentity();

      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: staff.id,
        title: 'Original title',
        body: 'Original body',
        audience: 'everyone',
        postedAs: 'myuno',
      });

      // Update while draft
      await announcementService.updateAnnouncement(db, announcementId, staff.id, {
        title: 'Updated title',
      });

      const announcement = await db.announcement.findUnique({
        where: { id: announcementId },
      });

      expect(announcement?.title).toBe('Updated title');
    });

    it('cannot update published announcement', async () => {
      const project = await createProject();
      const staff = await createIdentity();

      const { id: announcementId } = await announcementService.createAnnouncement(db, {
        projectId: project.id,
        createdByIdentityId: staff.id,
        title: 'Test',
        body: 'Content',
        audience: 'everyone',
        postedAs: 'myuno',
      });

      // Publish
      await announcementService.publishAnnouncement(db, announcementId, staff.id);

      // Try to update
      await expect(
        announcementService.updateAnnouncement(db, announcementId, staff.id, {
          title: 'New title',
        })
      ).rejects.toThrow('Cannot edit published');
    });
  });
});
