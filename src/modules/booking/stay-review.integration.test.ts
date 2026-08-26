import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';
import { writeStayReview, getStayReviewEligibility } from './stay-review.service';

describe('stay-review.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getStayReviewEligibility', () => {
    it('allows a guest to review their completed stay', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });

      const result = await getStayReviewEligibility(db, booking.id, guest.id);
      expect(result.canReview).toBe(true);
    });

    it('rejects a non-guest', async () => {
      const guest = await createIdentity();
      const other = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });

      const result = await getStayReviewEligibility(db, booking.id, other.id);
      expect(result.canReview).toBe(false);
      expect(result.reason).toContain('did not take this stay');
    });

    it('rejects a guest whose stay is not over', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
      });

      const result = await getStayReviewEligibility(db, booking.id, guest.id);
      expect(result.canReview).toBe(false);
      expect(result.reason).toContain('not over');
    });

    it('rejects a guest who already reviewed', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });

      // Create a review
      await db.review.create({
        data: {
          target_type: 'stay',
          target_id: booking.id,
          author_identity_id: guest.id,
          rating: 5,
          status: 'published',
        },
      });

      const result = await getStayReviewEligibility(db, booking.id, guest.id);
      expect(result.canReview).toBe(false);
      expect(result.reason).toContain('already reviewed');
    });
  });

  describe('writeStayReview', () => {
    it('creates a stay review', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });

      const result = await writeStayReview(db, {
        bookingId: booking.id,
        guestIdentityId: guest.id,
        rating: 4,
        comment: 'Great stay!',
      });

      expect(result.id).toBeDefined();

      const review = await db.review.findUnique({ where: { id: result.id } });
      expect(review).toBeDefined();
      expect(review?.target_type).toBe('stay');
      expect(review?.target_id).toBe(booking.id);
      expect(review?.author_identity_id).toBe(guest.id);
      expect(review?.rating).toBe(4);
      expect(review?.comment).toBe('Great stay!');
      expect(review?.status).toBe('published');
    });

    it('rejects invalid rating', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });

      await expect(
        writeStayReview(db, {
          bookingId: booking.id,
          guestIdentityId: guest.id,
          rating: 6,
        })
      ).rejects.toThrow('Rating must be 1–5');
    });

    it('rejects ineligible guest', async () => {
      const guest = await createIdentity();
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id, { ownerIdentityId: owner.id });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'confirmed',
      });

      await expect(
        writeStayReview(db, {
          bookingId: booking.id,
          guestIdentityId: guest.id,
          rating: 4,
        })
      ).rejects.toThrow('not over');
    });
  });
});
