import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
  createProvider,
  createService,
} from '@/test/util';
import { getInStayHomeSpace } from './home-space.service';

/**
 * T-034 DoD: the guest sees exactly their stay's project scope.
 *
 * The home space is the one screen a guest lives in for a week, so everything
 * on it has to belong to the stay they are actually on — a neighbouring
 * project's announcements and its providers' services are not theirs to see.
 */
describe('In-stay home space — stay project scope (T-034)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function stayIn(projectName?: string) {
    const project = await createProject({ name: projectName });
    const unit = await createUnit(project.id);
    const guest = await createIdentity();
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'checked_in',
    });

    return { project, unit, guest, booking };
  }

  async function publishAnnouncement(projectId: string, title: string) {
    const author = await createIdentity();
    return db.announcement.create({
      data: {
        projectId,
        createdByIdentityId: author.id,
        title,
        body: 'body',
        audience: 'everyone',
        postedAs: 'myuno',
        status: 'published',
      },
    });
  }

  /** A vetted, active provider — the only kind whose services are public. */
  async function vettedProvider() {
    const provider = await createProvider({ status: 'active' });
    return db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });
  }

  describe('announcements', () => {
    it('shows the stay project-s announcements and no other project-s', async () => {
      const { project, guest, booking } = await stayIn();
      const elsewhere = await createProject();

      const mine = await publishAnnouncement(project.id, 'Pool closed Tuesday');
      const theirs = await publishAnnouncement(elsewhere.id, 'Lobby works next door');

      const data = await getInStayHomeSpace(db, booking.id, guest.id);
      const ids = data.announcements.map((a) => a.id);

      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });

    it('does not show a draft announcement the project has not published', async () => {
      const { project, guest, booking } = await stayIn();
      const author = await createIdentity();

      const draft = await db.announcement.create({
        data: {
          projectId: project.id,
          createdByIdentityId: author.id,
          title: 'Not ready',
          body: 'body',
          audience: 'everyone',
          postedAs: 'myuno',
          status: 'draft',
        },
      });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.announcements.map((a) => a.id)).not.toContain(draft.id);
    });
  });

  describe('services rail', () => {
    it('carries services offered at this project, not another project-s', async () => {
      const { project, guest, booking } = await stayIn();
      const elsewhere = await createProject();
      const provider = await vettedProvider();

      const here = await createService({ providerId: provider.id, status: 'active' });
      await db.serviceProject.create({
        data: { service_id: here.id, project_id: project.id },
      });

      const overThere = await createService({ providerId: provider.id, status: 'active' });
      await db.serviceProject.create({
        data: { service_id: overThere.id, project_id: elsewhere.id },
      });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);
      const ids = data.services.map((s) => s.id);

      expect(ids).toContain(here.id);
      expect(ids).not.toContain(overThere.id);
    });

    it('carries an unrestricted service, which is offered everywhere', async () => {
      const { guest, booking } = await stayIn();
      const provider = await vettedProvider();

      // No ServiceProject rows at all = no project restriction.
      const everywhere = await createService({ providerId: provider.id, status: 'active' });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.services.map((s) => s.id)).toContain(everywhere.id);
    });

    it('never advertises a draft service or an unvetted provider', async () => {
      const { guest, booking } = await stayIn();

      const vetted = await vettedProvider();
      const draft = await createService({ providerId: vetted.id, status: 'draft' });

      const unvetted = await createProvider({ status: 'applied' });
      const fromUnvetted = await createService({ providerId: unvetted.id, status: 'active' });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);
      const ids = data.services.map((s) => s.id);

      expect(ids).not.toContain(draft.id);
      expect(ids).not.toContain(fromUnvetted.id);
    });
  });

  describe('access', () => {
    it('refuses a guest who is not on this booking', async () => {
      const { booking } = await stayIn();
      const stranger = await createIdentity();

      await expect(getInStayHomeSpace(db, booking.id, stranger.id)).rejects.toThrow(
        'Access denied'
      );
    });

    it('refuses the guest of a different stay in the same project', async () => {
      const { project, unit } = await stayIn();
      const neighbourGuest = await createIdentity();

      // A real neighbour: same project, same unit, different stay.
      await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: neighbourGuest.id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
      });

      const otherGuest = await createIdentity();
      const otherBooking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: otherGuest.id,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-05'),
      });

      await expect(getInStayHomeSpace(db, otherBooking.id, neighbourGuest.id)).rejects.toThrow(
        'Access denied'
      );
    });
  });

  describe('role composition (RoleContextBanner)', () => {
    it('reports no secondary role for an ordinary guest', async () => {
      const { guest, booking } = await stayIn();

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.secondaryRoles).toEqual([]);
    });

    it('reports owner when the guest is staying in their own unit (F-OWN-6)', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: owner.id,
        status: 'checked_in',
      });

      const data = await getInStayHomeSpace(db, booking.id, owner.id);

      expect(data.secondaryRoles).toContain('owner');
    });

    it('reports a role granted on the stay-s project', async () => {
      const { project, guest, booking } = await stayIn();

      await db.roleAssignment.create({
        data: {
          identityId: guest.id,
          role: 'resident',
          scopeType: 'project',
          projectId: project.id,
          status: 'active',
        },
      });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.secondaryRoles).toContain('resident');
    });

    it('ignores a role held somewhere else entirely', async () => {
      const { guest, booking } = await stayIn();
      const elsewhere = await createProject();

      await db.roleAssignment.create({
        data: {
          identityId: guest.id,
          role: 'resident',
          scopeType: 'project',
          projectId: elsewhere.id,
          status: 'active',
        },
      });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.secondaryRoles).toEqual([]);
    });

    it('ignores a revoked role', async () => {
      const { project, guest, booking } = await stayIn();

      await db.roleAssignment.create({
        data: {
          identityId: guest.id,
          role: 'resident',
          scopeType: 'project',
          projectId: project.id,
          status: 'revoked',
        },
      });

      const data = await getInStayHomeSpace(db, booking.id, guest.id);

      expect(data.secondaryRoles).toEqual([]);
    });
  });
});
