import { describe, it, expect, beforeEach } from 'vitest';
import {
  db as prisma,
  resetDb,
  createProject,
  createUnit,
  createIdentity,
  createBooking,
  makeProjectPublicMediaReady,
} from '@/test/util';
import {
  listPublicProjects,
  getPublicProjectBySlug,
  listPublicUnitIds,
} from './public.service';

async function createProjectWithMedia(options: Parameters<typeof createProject>[0] = {}) {
  const project = await createProject(options);
  await makeProjectPublicMediaReady(project.id);
  return project;
}

describe('Projects public read seam (discovery pages)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('listPublicProjects', () => {
    it('returns only live projects', async () => {
      await createProjectWithMedia({ slug: 'draft-p', status: 'draft' });
      await createProjectWithMedia({ slug: 'live-p', status: 'live' });

      const projects = await listPublicProjects();
      expect(projects.map((p) => p.slug)).toEqual(['live-p']);
    });

    it('counts live units and provenance-backed drafts, never an arbitrary draft, and prices only bookable live units', async () => {
      const project = await createProjectWithMedia({ slug: 'live-p', status: 'live' });
      await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 3000 });
      await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 2500 });
      await createUnit({ projectId: project.id, status: 'draft', baseNightlyThb: 100 });

      const [card] = await listPublicProjects();
      // A draft without import provenance is not public inventory. Inquiry-only
      // drafts are covered by the provenance-backed case below.
      expect(card.liveUnitCount).toBe(2);
      expect(card.fromNightlyThb).toBe(2500);
    });

    it('returns a null from-price when a live project has no live units', async () => {
      await createProjectWithMedia({ slug: 'empty-p', status: 'live' });

      const [card] = await listPublicProjects();
      expect(card.liveUnitCount).toBe(0);
      expect(card.fromNightlyThb).toBeNull();
    });

    it('publishes provenance-backed managed draft inventory without publishing unrelated drafts', async () => {
      const imported = await createProjectWithMedia({ slug: 'imported-draft', status: 'draft' });
      const unrelated = await createProjectWithMedia({ slug: 'unrelated-draft', status: 'draft' });
      const importedUnit = await createUnit({
        projectId: imported.id,
        status: 'draft',
        assetStatus: 'managed',
        name: 'Imported managed home',
      });
      await createUnit({
        projectId: unrelated.id,
        status: 'draft',
        assetStatus: 'managed',
        name: 'Unrelated draft home',
      });

      const source = await prisma.externalSystem.create({
        data: {
          system_key: 'yandex_disk_public_media',
          environment: 'test-import',
          display_name: 'Managed import provenance',
          config: { authority: 'media_source_only' },
        },
      });
      await prisma.externalMapping.createMany({
        data: [
          {
            external_system_id: source.id,
            entity_type: 'project',
            internal_id: imported.id,
            external_id: 'imported-project',
          },
          {
            external_system_id: source.id,
            entity_type: 'unit',
            internal_id: importedUnit.id,
            external_id: 'imported-unit',
          },
        ],
      });

      const projects = await listPublicProjects();
      expect(projects.map(project => project.slug)).toEqual(['imported-draft']);
      expect(projects[0].liveUnitCount).toBe(1);

      const detail = await getPublicProjectBySlug(imported.slug);
      expect(detail?.units.map(unit => unit.id)).toEqual([importedUnit.id]);
      expect(await getPublicProjectBySlug(unrelated.slug)).toBeNull();
    });
  });

  describe('getPublicProjectBySlug', () => {
    it('returns null for unknown slugs', async () => {
      expect(await getPublicProjectBySlug('nope')).toBeNull();
    });

    it('returns null for non-live projects so drafts never leak', async () => {
      await createProjectWithMedia({ slug: 'draft-p', status: 'draft' });
      expect(await getPublicProjectBySlug('draft-p')).toBeNull();
    });

    it('keeps a live media-incomplete unit visible for inquiry but out of bookable sitemap', async () => {
      const project = await createProjectWithMedia({ slug: 'media-gated-p', status: 'live' });
      const hidden = await createUnit({
        projectId: project.id,
        status: 'live',
        name: 'No photos',
        publicMediaReady: false,
      });
      const visible = await createUnit({
        projectId: project.id,
        status: 'live',
        name: 'Ready home',
      });

      const detail = await getPublicProjectBySlug(project.slug);
      expect(detail?.units.map((unit) => unit.id)).toEqual([hidden.id, visible.id]);
      expect(detail?.units.find((unit) => unit.id === hidden.id)).toMatchObject({
        mediaReady: false,
        bookable: false,
      });
      expect(detail?.units.find((unit) => unit.id === visible.id)).toMatchObject({
        mediaReady: true,
        bookable: true,
      });
      expect(await listPublicUnitIds()).toEqual([visible.id]);
    });

    it('returns the live project with only its live units, cheapest first', async () => {
      const project = await createProjectWithMedia({ slug: 'live-p', status: 'live' });
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
    it('a live unit receives a canonical category even without a hand-built catalog', async () => {
      const project = await createProjectWithMedia({ slug: 'plain-p', status: 'live' });
      const unit = await createUnit({ projectId: project.id, status: 'live' });

      const detail = await getPublicProjectBySlug('plain-p');
      expect(detail!.categories).toHaveLength(1);
      expect(detail!.categories[0]).toMatchObject({
        key: unit.categoryKey,
        unitCount: 1,
        fromNightlyThb: unit.baseNightlyThb,
      });
      expect(detail!.reviews).toEqual({ average: null, count: 0, items: [] });
    });

    it('builds category cards from canonical inventory categories', async () => {
      const project = await createProjectWithMedia({ slug: 'resort-p', status: 'live' });
      const category = await prisma.inventoryCategory.create({
        data: {
          projectId: project.id,
          categoryKey: 'superior_2br',
          name: 'Superior 2BR',
          bedrooms: 2,
          bathrooms: 2,
          maxGuests: 4,
          baseNightlyThb: 626100,
          minNights: 1,
          status: 'live',
        },
      });
      await createUnit({
        projectId: project.id,
        status: 'live',
        categoryKey: 'superior_2br',
        inventoryCategoryId: category.id,
        baseNightlyThb: 999,
      });
      await createUnit({
        projectId: project.id,
        status: 'live',
        categoryKey: 'superior_2br',
        inventoryCategoryId: category.id,
        baseNightlyThb: 999,
      });

      const detail = await getPublicProjectBySlug('resort-p');
      expect(detail!.categories).toHaveLength(1);
      expect(detail!.categories[0]).toMatchObject({
        key: 'superior_2br',
        unitCount: 2,
        fromNightlyThb: 626100,
      });
    });

    it('exposes only published stay reviews of this project, first name only', async () => {
      const project = await createProjectWithMedia({ slug: 'reviewed-p', status: 'live' });
      const otherProject = await createProjectWithMedia({ status: 'live' });
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

  describe('commercial and source-authority visibility across public surfaces', () => {
    it('does not count sale-only and lease-only units as bookable stays', async () => {
      const project = await createProjectWithMedia({ slug: 'mixed-commercial', status: 'live' });
      await prisma.project.update({ where: { id: project.id }, data: { projectType: 'condominium' } });
      const sale = await createUnit({ withoutStayOffering: true, projectId: project.id, status: 'live', name: 'Sale only' });
      const lease = await createUnit({ withoutStayOffering: true, projectId: project.id, status: 'live', name: 'Lease only' });
      const stay = await createUnit({ withoutStayOffering: true, projectId: project.id, status: 'live', name: 'Stay' });
      await prisma.commercialOffering.createMany({ data: [
        { unitId: sale.id, offeringType: 'sale', status: 'active' },
        { unitId: lease.id, offeringType: 'long_term_rental', status: 'active' },
        { unitId: stay.id, offeringType: 'short_term_stay', status: 'active' },
      ] });
      const [card] = await listPublicProjects();
      const detail = await getPublicProjectBySlug(project.slug);
      expect(card.liveUnitCount).toBe(3);
      expect(detail?.units.map(u => u.id).sort()).toEqual([sale.id, lease.id, stay.id].sort());
      expect(detail?.units.find(u => u.id === sale.id)?.bookable).toBe(false);
      expect(detail?.units.find(u => u.id === lease.id)?.bookable).toBe(false);
      expect(detail?.units.find(u => u.id === stay.id)?.bookable).toBe(true);
      expect(detail?.categories.reduce((sum, c) => sum + c.unitCount, 0)).toBe(3);
      expect(await listPublicUnitIds()).toEqual([stay.id]);
    });

    it('keeps source-owned inventory visible for inquiry but excludes it from booking until signed cutover', async () => {
      const project = await createProjectWithMedia({ slug: 'source-project', status: 'live' });
      const sourceUnit = await createUnit({ projectId: project.id, status: 'live', name: 'Protected source' });
      const localUnit = await createUnit({ projectId: project.id, status: 'live', name: 'Local unit' });
      const source = await prisma.externalSystem.create({ data: {
        system_key: 'layantara_os', environment: 'test', display_name: 'Source',
        config: { bookingAuthority: 'layantara_os', cutoverVerified: false },
      } });
      await prisma.externalMapping.create({ data: {
        external_system_id: source.id, entity_type: 'unit',
        internal_id: sourceUnit.id, external_id: 'source-villa',
      } });
      const beforeCutover = await getPublicProjectBySlug(project.slug);
      expect(beforeCutover?.units.map(u => u.id).sort()).toEqual([sourceUnit.id, localUnit.id].sort());
      expect(beforeCutover?.units.find(u => u.id === sourceUnit.id)?.bookable).toBe(false);
      expect((await listPublicProjects())[0].liveUnitCount).toBe(2);
      expect(await listPublicUnitIds()).toEqual([localUnit.id]);
      await prisma.externalSystem.update({ where: { id: source.id },
        data: { config: { bookingAuthority: 'myuno', cutoverVerified: true } } });
      const afterCutover = await getPublicProjectBySlug(project.slug);
      expect(afterCutover?.units).toHaveLength(2);
      expect(afterCutover?.units.find(u => u.id === sourceUnit.id)?.bookable).toBe(true);
    });
  });

  describe('listPublicUnitIds', () => {
    it('lists only live units inside live projects', async () => {
      const live = await createProjectWithMedia({ slug: 'live-p', status: 'live' });
      const draft = await createProjectWithMedia({ slug: 'draft-p', status: 'draft' });
      const visible = await createUnit({ projectId: live.id, status: 'live' });
      await createUnit({ projectId: live.id, status: 'draft' });
      await createUnit({ projectId: draft.id, status: 'live' });

      const ids = await listPublicUnitIds();
      expect(ids).toEqual([visible.id]);
    });
  });
});
