import { describe, it, expect, beforeEach } from 'vitest';
import {
  db as prisma,
  resetDb,
  createProject,
  createUnit,
  createIdentity,
  createBooking,
} from '@/test/util';
import {
  listPublicProjects,
  getPublicProjectBySlug,
  listPublicUnitIds,
} from './public.service';

describe('Projects public read seam (discovery pages)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('listPublicProjects', () => {
    it('returns only live projects', async () => {
      await createProject({ slug: 'draft-p', status: 'draft' });
      await createProject({ slug: 'live-p', status: 'live' });

      const projects = await listPublicProjects();
      expect(projects.map((p) => p.slug)).toEqual(['live-p']);
    });

    it('counts only live units and computes the from-price over them', async () => {
      const project = await createProject({ slug: 'live-p', status: 'live' });
      await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 3000 });
      await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 2500 });
      await createUnit({ projectId: project.id, status: 'draft', baseNightlyThb: 100 });

      const [card] = await listPublicProjects();
      expect(card.liveUnitCount).toBe(2);
      expect(card.fromNightlyThb).toBe(2500);
    });

    it('returns a null from-price when a live project has no live units', async () => {
      await createProject({ slug: 'empty-p', status: 'live' });

      const [card] = await listPublicProjects();
      expect(card.liveUnitCount).toBe(0);
      expect(card.fromNightlyThb).toBeNull();
    });
  });

  describe('getPublicProjectBySlug', () => {
    it('returns null for unknown slugs', async () => {
      expect(await getPublicProjectBySlug('nope')).toBeNull();
    });

    it('returns null for non-live projects so drafts never leak', async () => {
      await createProject({ slug: 'draft-p', status: 'draft' });
      expect(await getPublicProjectBySlug('draft-p')).toBeNull();
    });

    it('returns the live project with only its live units, cheapest first', async () => {
      const project = await createProject({ slug: 'live-p', status: 'live' });
      await createUnit({
        projectId: project.id,
        status: 'live',
        name: 'B',
        baseNightlyThb: 4000,
      });
      await createUnit({
        projectId: project.id,
        status: 'live',
        name: 'A',
        baseNightlyThb: 2000,
      });
      await createUnit({ projectId: project.id, status: 'paused', name: 'Hidden' });

      const detail = await getPublicProjectBySlug('live-p');
      expect(detail).not.toBeNull();
      expect(detail!.units.map((u) => u.name)).toEqual(['A', 'B']);
      expect(detail!.units[0].baseNightlyThb).toBe(2000);
    });
  });

  describe('categories & reviews on the landing payload (LY-5)', () => {
    it('a project without a unit-categories catalog gets empty categories and reviews', async () => {
      const project = await createProject({ slug: 'plain-p', status: 'live' });
      await createUnit({ projectId: project.id, status: 'live' });

      const detail = await getPublicProjectBySlug('plain-p');
      expect(detail!.categories).toEqual([]);
      expect(detail!.reviews).toEqual({ average: null, count: 0, items: [] });
    });

    it('builds category cards with counts and from-prices from the rate grid', async () => {
      const project = await createProject({ slug: 'resort-p', status: 'live' });
      await createUnit({
        projectId: project.id,
        status: 'live',
        categoryKey: 'superior_2br',
        baseNightlyThb: 999,
      });
      await createUnit({
        projectId: project.id,
        status: 'live',
        categoryKey: 'superior_2br',
        baseNightlyThb: 999,
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'catalog.unit_categories',
          scopeType: 'project',
          scopeId: project.id,
          value: [
            { key: 'superior_2br', style_key: 'phase_2_minimal', bedrooms: 2 },
            { key: 'grand_deluxe_3br', style_key: 'garden_continental', bedrooms: 3 },
          ] as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.category_rates',
          scopeType: 'project',
          scopeId: project.id,
          value: {
            superior_2br: {
              nightly: { low: 626100, peak: 1127200 },
              monthly: { low: 7200000 },
            },
          } as any,
          updatedByIdentityId: 'test-admin',
        },
      });

      const detail = await getPublicProjectBySlug('resort-p');
      // grand_deluxe has no live units → dropped from the cards
      expect(detail!.categories).toHaveLength(1);
      expect(detail!.categories[0]).toMatchObject({
        key: 'superior_2br',
        styleKey: 'phase_2_minimal',
        unitCount: 2,
        fromNightlyThb: 626100, // lowest season rate, not the unit base price
        monthlyFromThb: 7200000,
      });
    });

    it('exposes only published stay reviews of this project, first name only', async () => {
      const project = await createProject({ slug: 'reviewed-p', status: 'live' });
      const otherProject = await createProject({ status: 'live' });
      const unit = await createUnit({ projectId: project.id, status: 'live' });
      const otherUnit = await createUnit({ projectId: otherProject.id, status: 'live' });
      const guest = await createIdentity({ firstName: 'Anna' });
      const otherGuest = await createIdentity({ firstName: 'Boris' });

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        status: 'checked_out',
      });
      const foreignBooking = await createBooking({
        unitId: otherUnit.id,
        projectId: otherProject.id,
        guestIdentityId: otherGuest.id,
        status: 'checked_out',
      });

      await prisma.review.create({
        data: {
          target_type: 'stay',
          target_id: booking.id,
          author_identity_id: guest.id,
          rating: 5,
          comment: 'Wonderful villa',
          status: 'published',
        },
      });
      await prisma.review.create({
        data: {
          target_type: 'stay',
          target_id: foreignBooking.id,
          author_identity_id: otherGuest.id,
          rating: 1,
          comment: 'Different project',
          status: 'published',
        },
      });
      // Hidden review of this project must not appear or affect the average
      await prisma.review.create({
        data: {
          target_type: 'stay',
          target_id: booking.id,
          author_identity_id: otherGuest.id,
          rating: 1,
          comment: 'Hidden',
          status: 'hidden',
        },
      });

      const detail = await getPublicProjectBySlug('reviewed-p');
      expect(detail!.reviews.count).toBe(1);
      expect(detail!.reviews.average).toBe(5);
      expect(detail!.reviews.items[0]).toMatchObject({
        rating: 5,
        comment: 'Wonderful villa',
        authorFirstName: 'Anna',
      });
      const raw = JSON.stringify(detail!.reviews);
      expect(raw).not.toContain('Different project');
      expect(raw).not.toContain('Hidden');
    });
  });

  describe('listPublicUnitIds', () => {
    it('lists only live units inside live projects', async () => {
      const live = await createProject({ slug: 'live-p', status: 'live' });
      const draft = await createProject({ slug: 'draft-p', status: 'draft' });
      const visible = await createUnit({ projectId: live.id, status: 'live' });
      await createUnit({ projectId: live.id, status: 'draft' });
      await createUnit({ projectId: draft.id, status: 'live' });

      const ids = await listPublicUnitIds();
      expect(ids).toEqual([visible.id]);
    });
  });
});
