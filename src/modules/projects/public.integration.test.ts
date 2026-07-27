import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, createProject, createUnit } from '@/test/util';
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
