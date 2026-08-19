import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import {
  writeGuestReview,
  getGuestReviewEligibility,
  getGuestReputation,
} from './guest-review.service';

/**
 * Reviews used to run one way. Guests reviewed stays and service orders; nobody
 * reviewed the guest — so an owner could not answer "who stayed in my villa, and
 * were they any good", and an operator had no basis for declining a returning
 * guest who was a problem.
 */
describe('reviewing the guest', () => {
  let projectId: string;
  let unitId: string;
  let ownerId: string;
  let guestId: string;
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();

    const owner = await createIdentity({ firstName: 'Owner' });
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, status: 'live' });
    const guest = await createIdentity({ firstName: 'Guest' });

    ownerId = owner.id;
    projectId = project.id;
    unitId = unit.id;
    guestId = guest.id;

    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guestId,
      status: 'checked_out',
    });
    bookingId = booking.id;
  });

  describe('who may write one', () => {
    it('lets the unit owner review their guest', async () => {
      const review = await writeGuestReview(db, {
        bookingId,
        authorIdentityId: ownerId,
        rating: 5,
        comment: 'Left the villa spotless.',
      });

      expect(review.rating).toBe(5);
      expect(review.target_type).toBe('guest');
      expect(review.target_id).toBe(bookingId);
    });

    it('lets operating staff review, because a managed owner may never meet the guest', async () => {
      const staff = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: staff.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId,
          status: 'active',
        },
      });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: staff.id, rating: 4 })
      ).resolves.toBeTruthy();
    });

    it('lets an admin review', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: admin.id, rating: 3 })
      ).resolves.toBeTruthy();
    });

    it('refuses a stranger — a review of a named person is not open to anyone', async () => {
      const stranger = await createIdentity();

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: stranger.id, rating: 1 })
      ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
    });

    it('refuses staff scoped to a different project', async () => {
      const elsewhere = await createProject();
      const staff = await createIdentity();
      await db.roleAssignment.create({
        data: {
          identityId: staff.id,
          role: 'staff_ops',
          scopeType: 'project',
          projectId: elsewhere.id,
          status: 'active',
        },
      });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: staff.id, rating: 1 })
      ).rejects.toThrow(/owner or operating staff/i);
    });

    it('refuses the guest reviewing themselves', async () => {
      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: guestId, rating: 5 })
      ).rejects.toThrow(/cannot review themselves/i);
    });
  });

  describe('when it may be written', () => {
    it('refuses while the stay is still running', async () => {
      await db.booking.update({ where: { id: bookingId }, data: { status: 'checked_in' } });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 5 })
      ).rejects.toThrow(/not over yet/i);
    });

    it('accepts once the stay is completed', async () => {
      await db.booking.update({ where: { id: bookingId }, data: { status: 'completed' } });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 5 })
      ).resolves.toBeTruthy();
    });

    it('refuses a second review of the same stay by the same author', async () => {
      await writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 5 });

      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 1 })
      ).rejects.toThrow(/already reviewed/i);
    });

    it('reports why, before the form is shown', async () => {
      await writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 5 });

      const eligibility = await getGuestReviewEligibility(db, bookingId, ownerId);
      expect(eligibility.canReview).toBe(false);
      expect(eligibility.reason).toMatch(/already reviewed/i);
    });
  });

  describe('the rating itself', () => {
    it.each([0, 6, 2.5, -1])('refuses %s', async (rating) => {
      await expect(
        writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: rating as number })
      ).rejects.toThrow(/whole number from 1 to 5/i);
    });
  });

  describe('a guest-s reputation across stays', () => {
    it('is unknown, not zero, for a guest nobody has reviewed', async () => {
      const reputation = await getGuestReputation(db, guestId);

      // A new guest is unknown, not bad. A screen that cannot tell those apart
      // quietly punishes first-time visitors.
      expect(reputation.averageRating).toBeNull();
      expect(reputation.reviewCount).toBe(0);
    });

    it('averages every stay, because the target is the booking not the person', async () => {
      await writeGuestReview(db, { bookingId, authorIdentityId: ownerId, rating: 5 });

      // The same guest returns; the same owner reviews them again.
      const second = await createBooking({
        unitId,
        projectId,
        guestIdentityId: guestId,
        status: 'checked_out',
        startDate: new Date('2027-02-01'),
        endDate: new Date('2027-02-05'),
      });
      await writeGuestReview(db, {
        bookingId: second.id,
        authorIdentityId: ownerId,
        rating: 3,
      });

      const reputation = await getGuestReputation(db, guestId);

      expect(reputation.reviewCount).toBe(2);
      expect(reputation.averageRating).toBe(4);
    });

    it('leaves out another guest-s reviews', async () => {
      const otherGuest = await createIdentity();
      const otherBooking = await createBooking({
        unitId,
        projectId,
        guestIdentityId: otherGuest.id,
        status: 'checked_out',
        startDate: new Date('2027-03-01'),
        endDate: new Date('2027-03-05'),
      });
      await writeGuestReview(db, {
        bookingId: otherBooking.id,
        authorIdentityId: ownerId,
        rating: 1,
      });

      const reputation = await getGuestReputation(db, guestId);
      expect(reputation.reviewCount).toBe(0);
    });

    it('leaves out a hidden review', async () => {
      const review = await writeGuestReview(db, {
        bookingId,
        authorIdentityId: ownerId,
        rating: 1,
      });
      await db.review.update({ where: { id: review.id }, data: { status: 'hidden' } });

      expect((await getGuestReputation(db, guestId)).reviewCount).toBe(0);
    });
  });
});
