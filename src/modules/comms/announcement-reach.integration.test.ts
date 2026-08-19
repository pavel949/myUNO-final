import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createOrganization } from '@/test/util';
import {
  createAnnouncement,
  publishAnnouncement,
  getProjectAnnouncements,
  resolvePostingAuthority,
  inStayGuestIdentityIds,
} from './announcement.service';

/**
 * Announcements reached the wrong people in both directions.
 *
 * Nothing in the product could write one at all — `createAnnouncement` had no
 * caller — and underneath that, two scoping bugs meant that even a hand-written
 * announcement went astray: the guest home space showed every published
 * announcement regardless of audience, and publishing to `guests_in_stay`
 * notified nobody because it looked for a role row that booking never writes.
 */
describe('who an announcement reaches', () => {
  let projectId: string;
  let unitId: string;
  let staffId: string;

  const announce = async (audience: 'everyone' | 'owners' | 'guests_in_stay' | 'staff', title: string) => {
    const { id } = await createAnnouncement(db, {
      projectId,
      createdByIdentityId: staffId,
      title,
      body: 'Body text.',
      audience,
      postedAs: 'myuno',
    });
    return id;
  };

  beforeEach(async () => {
    await resetDb();
    const project = await createProject();
    projectId = project.id;
    const unit = await createUnit(projectId);
    unitId = unit.id;
    const staff = await createIdentity();
    staffId = staff.id;
  });

  describe('the guest in stay', () => {
    let guestId: string;

    beforeEach(async () => {
      const guest = await createIdentity();
      guestId = guest.id;
      // A stay in progress. Note there is deliberately no `guest` role row:
      // booking has never written one, which is the whole problem.
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'checked_in',
      });
    });

    it('is counted as in stay from the booking, not from a role', async () => {
      const inStay = await inStayGuestIdentityIds(db, projectId);
      expect(inStay).toEqual([guestId]);

      const roles = await db.roleAssignment.findMany({ where: { identityId: guestId } });
      expect(roles).toHaveLength(0);
    });

    it('is notified by an announcement addressed to guests in stay', async () => {
      // This used to notify nobody: the audience resolved through a role row
      // that does not exist, so publishing succeeded and reached zero people.
      const id = await announce('guests_in_stay', 'Water off tomorrow');
      await publishAnnouncement(db, id, staffId);

      const notifications = await db.notification.findMany({ where: { identityId: guestId } });
      expect(notifications).toHaveLength(1);
    });

    it('is notified by an announcement addressed to everyone', async () => {
      const id = await announce('everyone', 'Pool closed');
      await publishAnnouncement(db, id, staffId);

      const notifications = await db.notification.findMany({ where: { identityId: guestId } });
      expect(notifications).toHaveLength(1);
    });

    it('is not shown an announcement addressed to owners', async () => {
      // The home space used to render every published announcement in the
      // project, so an owner-only notice about service charges appeared on a
      // holidaymaker's screen.
      const owners = await announce('owners', 'Service charge review');
      await publishAnnouncement(db, owners, staffId);
      const everyone = await announce('everyone', 'Pool closed');
      await publishAnnouncement(db, everyone, staffId);

      const visible = await getProjectAnnouncements(db, projectId, guestId, {
        alsoInclude: ['guests_in_stay'],
      });

      expect(visible.map((a) => a.title)).toEqual(['Pool closed']);
    });

    it('is not shown an expired announcement', async () => {
      const { id } = await createAnnouncement(db, {
        projectId,
        createdByIdentityId: staffId,
        title: 'Last month’s notice',
        body: 'Body text.',
        audience: 'everyone',
        postedAs: 'myuno',
        expiresAt: new Date('2020-01-01'),
      });
      await publishAnnouncement(db, id, staffId);

      const visible = await getProjectAnnouncements(db, projectId, guestId, {
        alsoInclude: ['guests_in_stay'],
      });
      expect(visible).toEqual([]);
    });
  });

  it('does not count a guest whose stay has not started', async () => {
    const future = await createIdentity();
    await createBooking({
      unitId,
      projectId,
      guestIdentityId: future.id,
      status: 'confirmed',
      startDate: new Date('2099-01-01'),
      endDate: new Date('2099-01-05'),
    });

    expect(await inStayGuestIdentityIds(db, projectId)).toEqual([]);
  });

  it('does not count a guest in a different project', async () => {
    const other = await createProject();
    const otherUnit = await createUnit(other.id);
    const elsewhere = await createIdentity();
    await createBooking({
      unitId: otherUnit.id,
      projectId: other.id,
      guestIdentityId: elsewhere.id,
      status: 'checked_in',
    });

    expect(await inStayGuestIdentityIds(db, projectId)).toEqual([]);
  });
});

describe('the voice an announcement is signed in', () => {
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject();
    projectId = project.id;
  });

  it('is myUNO for an admin', async () => {
    const admin = await createIdentity({ isAdmin: true });
    await expect(resolvePostingAuthority(db, admin.id, projectId, true)).resolves.toEqual({
      postedAs: 'myuno',
      organizationId: null,
    });
  });

  it('is myUNO for staff', async () => {
    const staff = await createIdentity();
    await db.roleAssignment.create({
      data: { identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId, status: 'active' },
    });

    const authority = await resolvePostingAuthority(db, staff.id, projectId, false);
    expect(authority.postedAs).toBe('myuno');
  });

  it('is the management company for one of its members, carrying the organisation', async () => {
    const org = await createOrganization('Andaman MC', projectId);
    const member = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: member.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId,
        organizationId: org.id,
        status: 'active',
      },
    });

    await expect(resolvePostingAuthority(db, member.id, projectId, false)).resolves.toEqual({
      postedAs: 'management_company',
      organizationId: org.id,
    });
  });

  it('is the juristic person for one of its members', async () => {
    const org = await createOrganization('Juristic', projectId, 'juristic_person');
    const member = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: member.id,
        role: 'juristic_member',
        scopeType: 'project',
        projectId,
        organizationId: org.id,
        status: 'active',
      },
    });

    const authority = await resolvePostingAuthority(db, member.id, projectId, false);
    expect(authority.postedAs).toBe('juristic_person');
  });

  it('refuses someone holding the role in a different project', async () => {
    // A management-company member for one building has no standing to speak in
    // another, and `postedAs` is a signature, not a preference.
    const elsewhere = await createProject();
    const org = await createOrganization('Other MC', elsewhere.id);
    const member = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: member.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: elsewhere.id,
        organizationId: org.id,
        status: 'active',
      },
    });

    await expect(resolvePostingAuthority(db, member.id, projectId, false)).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    });
  });

  it('refuses an owner, who is not one of the three voices', async () => {
    const owner = await createIdentity();
    await db.roleAssignment.create({
      data: { identityId: owner.id, role: 'owner', scopeType: 'project', projectId, status: 'active' },
    });

    await expect(resolvePostingAuthority(db, owner.id, projectId, false)).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    });
  });

  it('ignores a revoked role', async () => {
    const former = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: former.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId,
        status: 'revoked',
      },
    });

    await expect(resolvePostingAuthority(db, former.id, projectId, false)).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    });
  });
});

describe('publishing', () => {
  let projectId: string;
  let authorId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject();
    projectId = project.id;
    const author = await createIdentity();
    authorId = author.id;
  });

  const draft = async () =>
    (
      await createAnnouncement(db, {
        projectId,
        createdByIdentityId: authorId,
        title: 'Notice',
        body: 'Body.',
        audience: 'everyone',
        postedAs: 'myuno',
      })
    ).id;

  it('is allowed to an admin who did not write the draft', async () => {
    // The admin arm was a TODO, which meant a draft written by someone who had
    // since left could never be published or withdrawn by anyone.
    const id = await draft();
    const admin = await createIdentity({ isAdmin: true });

    await expect(publishAnnouncement(db, id, admin.id, true)).resolves.toBeUndefined();

    const stored = await db.announcement.findUnique({ where: { id } });
    expect(stored!.status).toBe('published');
  });

  it('is refused to someone who neither wrote it nor is an admin', async () => {
    const id = await draft();
    const stranger = await createIdentity();

    await expect(publishAnnouncement(db, id, stranger.id, false)).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    });
  });

  it('refuses a second time, so a building is not notified twice', async () => {
    const id = await draft();
    await publishAnnouncement(db, id, authorId);

    await expect(publishAnnouncement(db, id, authorId)).rejects.toMatchObject({
      code: 'ALREADY_PUBLISHED',
    });
  });
});
