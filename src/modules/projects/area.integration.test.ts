import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import {
  listAreas,
  listBrowsableAreas,
  getAreaForBrowse,
  createArea,
  updateArea,
  buildAreaTree,
  collectDescendantIds,
  wouldFormCycle,
  resolveAreaLabelKey,
  getAreaPerformance,
  getPortfolioByArea,
  type AreaNode,
} from './area.service';

/**
 * A location used to be a content key on the project — a string to display, not
 * a thing to ask questions about. Areas exist for the two jobs the founder
 * named: browse and reporting.
 */
describe('areas', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /** Phuket → west coast → {Bang Tao, Layan}, the shape the corridor actually has. */
  async function corridor() {
    const phuket = await createArea(db, {
      slug: 'phuket',
      nameKey: 'area.phuket.name',
      status: 'live',
    });
    const west = await createArea(db, {
      slug: 'phuket-west-coast',
      nameKey: 'area.west.name',
      parentId: phuket.id,
      status: 'live',
    });
    const bangTao = await createArea(db, {
      slug: 'bang-tao',
      nameKey: 'area.bang_tao.name',
      parentId: west.id,
      status: 'live',
      sort: 1,
    });
    const layan = await createArea(db, {
      slug: 'layan',
      nameKey: 'area.layan.name',
      parentId: west.id,
      status: 'live',
      sort: 2,
    });
    return { phuket, west, bangTao, layan };
  }

  describe('the shape of the tree', () => {
    it('nests to whatever depth is used, without a migration', async () => {
      const { phuket, west, bangTao } = await corridor();
      const areas = await listAreas(db);

      const tree = buildAreaTree(areas);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(phuket.id);
      expect(tree[0].children[0].id).toBe(west.id);
      expect(tree[0].children[0].children.map((c) => c.id)).toContain(bangTao.id);
    });

    it('orders siblings by sort, then slug — never by insertion', async () => {
      const parent = await createArea(db, { slug: 'p', nameKey: 'k' });
      await createArea(db, { slug: 'zebra', nameKey: 'k', parentId: parent.id, sort: 0 });
      await createArea(db, { slug: 'apple', nameKey: 'k', parentId: parent.id, sort: 0 });

      const tree = buildAreaTree(await listAreas(db));
      expect(tree[0].children.map((c) => c.slug)).toEqual(['apple', 'zebra']);
    });

    it('surfaces an orphan as a root rather than losing it', () => {
      // The parent was deleted (SetNull) or is simply absent. A node that
      // vanishes from the tree is worse than one shown at the top.
      const areas: AreaNode[] = [
        {
          id: 'orphan',
          slug: 'orphan',
          nameKey: 'k',
          descriptionKey: null,
          parentId: 'gone',
          status: 'live',
          sort: 0,
        },
      ];

      expect(buildAreaTree(areas).map((n) => n.id)).toEqual(['orphan']);
    });
  });

  describe('what an area covers', () => {
    it('includes everything beneath it', async () => {
      const { phuket, west, bangTao, layan } = await corridor();
      const areas = await listAreas(db);

      const ids = collectDescendantIds(areas, phuket.id);
      expect(ids.sort()).toEqual([phuket.id, west.id, bangTao.id, layan.id].sort());
    });

    it('covers only itself when it is a leaf', async () => {
      const { bangTao } = await corridor();

      expect(collectDescendantIds(await listAreas(db), bangTao.id)).toEqual([bangTao.id]);
    });

    it('covers nothing for an area that does not exist', async () => {
      await corridor();

      // Nothing, not everything. Silently widening a filtered view to the whole
      // portfolio is the dangerous direction to fail in.
      expect(collectDescendantIds(await listAreas(db), 'no-such-area')).toEqual([]);
    });

    it('terminates on a cycle instead of hanging', () => {
      const areas: AreaNode[] = [
        { id: 'a', slug: 'a', nameKey: 'k', descriptionKey: null, parentId: 'b', status: 'live', sort: 0 },
        { id: 'b', slug: 'b', nameKey: 'k', descriptionKey: null, parentId: 'a', status: 'live', sort: 0 },
      ];

      // Wrong data should produce a finite wrong answer, not a hung request.
      expect(collectDescendantIds(areas, 'a').sort()).toEqual(['a', 'b']);
    });
  });

  describe('refusing a cycle on write', () => {
    it('refuses to place an area inside itself', async () => {
      const { phuket } = await corridor();

      await expect(updateArea(db, phuket.id, { parentId: phuket.id })).rejects.toMatchObject({
        code: 'AREA_CYCLE',
      });
    });

    it('refuses to place an ancestor inside its own descendant', async () => {
      const { phuket, bangTao } = await corridor();

      // "Phuket is inside Bang Tao" — legal as a pair of writes, and every
      // later tree walk pays for it.
      await expect(updateArea(db, phuket.id, { parentId: bangTao.id })).rejects.toThrow(
        /inside itself/i
      );
    });

    it('allows a legitimate re-parent', async () => {
      const { phuket, bangTao } = await corridor();

      await expect(updateArea(db, bangTao.id, { parentId: phuket.id })).resolves.toBeTruthy();
    });

    it('refuses a parent that does not exist', async () => {
      const { bangTao } = await corridor();

      await expect(updateArea(db, bangTao.id, { parentId: 'nope' })).rejects.toThrow(/not found/i);
    });

    it('spots a cycle before one is created', async () => {
      const { phuket, west } = await corridor();
      const areas = await listAreas(db);

      expect(wouldFormCycle(areas, phuket.id, west.id)).toBe(true);
      expect(wouldFormCycle(areas, west.id, null)).toBe(false);
    });

    it('will not let the database store a self-parent either', async () => {
      const { layan } = await corridor();

      // The service guards it; the CHECK constraint means a direct write cannot
      // route around the service.
      await expect(
        db.$executeRawUnsafe(`UPDATE "area" SET parent_id = id WHERE id = '${layan.id}'`)
      ).rejects.toThrow();
    });
  });

  describe('which label a project shows', () => {
    it('prefers the area, so two projects cannot name one place differently', () => {
      expect(
        resolveAreaLabelKey({
          areaLabelKey: 'project.mine.location',
          area: { nameKey: 'area.bang_tao.name' },
        })
      ).toBe('area.bang_tao.name');
    });

    it('falls back to the project-s own label while it has no area', () => {
      expect(resolveAreaLabelKey({ areaLabelKey: 'project.mine.location', area: null })).toBe(
        'project.mine.location'
      );
    });
  });

  describe('browse', () => {
    it('shows the live projects in an area and beneath it', async () => {
      const { phuket, bangTao } = await corridor();
      await createProject({ slug: 'in-bang-tao', areaId: bangTao.id, status: 'live' });
      await createProject({ slug: 'elsewhere', status: 'live' });

      const page = await getAreaForBrowse(db, 'phuket');

      expect(page).not.toBeNull();
      expect(page!.area.id).toBe(phuket.id);
      expect(page!.projects.map((p) => p.slug)).toEqual(['in-bang-tao']);
    });

    it('leaves out a project that is not live', async () => {
      const { bangTao } = await corridor();
      await createProject({ slug: 'draft-one', areaId: bangTao.id, status: 'draft' });

      expect((await getAreaForBrowse(db, 'bang-tao'))!.projects).toHaveLength(0);
    });

    it('gives the public nothing for a draft area', async () => {
      await createArea(db, { slug: 'not-yet', nameKey: 'k', status: 'draft' });

      // One project in a region is a project, not a destination.
      expect(await getAreaForBrowse(db, 'not-yet')).toBeNull();
    });

    it('gives nothing for an area that does not exist', async () => {
      expect(await getAreaForBrowse(db, 'atlantis')).toBeNull();
    });

    it('lists an ancestor as browsable when only its descendants hold projects', async () => {
      const { bangTao } = await corridor();
      await createProject({ slug: 'p1', areaId: bangTao.id, status: 'live' });

      const browsable = await listBrowsableAreas(db);
      const bySlug = Object.fromEntries(browsable.map((a) => [a.slug, a.projectCount]));

      // A coast with nothing attached directly is still worth a page when its
      // beaches have projects.
      expect(bySlug['phuket']).toBe(1);
      expect(bySlug['phuket-west-coast']).toBe(1);
      expect(bySlug['bang-tao']).toBe(1);
      expect(bySlug['layan']).toBeUndefined();
    });
  });

  describe('reporting', () => {
    const FROM = new Date('2026-07-01');
    const TO = new Date('2026-07-31');

    async function metricsFor(projectId: string, unitId: string, day: string, m: {
      available: number;
      occupied: number;
      rental: number;
    }) {
      await db.metricDaily.create({
        data: {
          date: new Date(day),
          projectId,
          unitId,
          nightsAvailable: m.available,
          nightsOccupied: m.occupied,
          rentalRevenueCents: m.rental,
        },
      });
    }

    it('rolls a region up from the projects beneath it', async () => {
      const { phuket, bangTao, layan } = await corridor();
      const inBangTao = await createProject({ slug: 'bt', areaId: bangTao.id, status: 'live' });
      const inLayan = await createProject({ slug: 'ly', areaId: layan.id, status: 'live' });
      const u1 = await createUnit({ projectId: inBangTao.id, status: 'live' });
      const u2 = await createUnit({ projectId: inLayan.id, status: 'live' });

      await metricsFor(inBangTao.id, u1.id, '2026-07-01', { available: 1, occupied: 1, rental: 400_000 });
      await metricsFor(inLayan.id, u2.id, '2026-07-02', { available: 1, occupied: 0, rental: 0 });

      const performance = await getAreaPerformance(db, phuket.id, { from: FROM, to: TO });

      expect(performance!.projectCount).toBe(2);
      expect(performance!.nightsAvailable).toBe(2);
      expect(performance!.nightsOccupied).toBe(1);
      expect(performance!.occupancyPct).toBe(50);
      expect(performance!.adrThb).toBe(400_000);
    });

    it('counts only the branch asked about', async () => {
      const { bangTao, layan } = await corridor();
      const inBangTao = await createProject({ slug: 'bt', areaId: bangTao.id, status: 'live' });
      const inLayan = await createProject({ slug: 'ly', areaId: layan.id, status: 'live' });
      const u1 = await createUnit({ projectId: inBangTao.id, status: 'live' });
      const u2 = await createUnit({ projectId: inLayan.id, status: 'live' });

      await metricsFor(inBangTao.id, u1.id, '2026-07-01', { available: 1, occupied: 1, rental: 300_000 });
      await metricsFor(inLayan.id, u2.id, '2026-07-01', { available: 1, occupied: 1, rental: 900_000 });

      const performance = await getAreaPerformance(db, bangTao.id, { from: FROM, to: TO });
      expect(performance!.adrThb).toBe(300_000);
    });

    it('leaves out days outside the window', async () => {
      const { bangTao } = await corridor();
      const project = await createProject({ slug: 'bt', areaId: bangTao.id, status: 'live' });
      const unit = await createUnit({ projectId: project.id, status: 'live' });

      await metricsFor(project.id, unit.id, '2026-06-30', { available: 1, occupied: 1, rental: 500_000 });

      expect((await getAreaPerformance(db, bangTao.id, { from: FROM, to: TO }))!.nightsAvailable).toBe(0);
    });

    it('reports unknown, not zero, for a region with no inventory', async () => {
      const { layan } = await corridor();

      const performance = await getAreaPerformance(db, layan.id, { from: FROM, to: TO });

      // A region with nothing in it is not a region at 0% occupancy. A
      // dashboard that cannot tell those apart reports a catastrophe that is
      // really an absence.
      expect(performance!.occupancyPct).toBeNull();
      expect(performance!.adrThb).toBeNull();
      expect(performance!.projectCount).toBe(0);
    });

    it('gives nothing for an area that does not exist', async () => {
      expect(await getAreaPerformance(db, 'nope', { from: FROM, to: TO })).toBeNull();
    });

    it('reports every area in one pass, agreeing with the single-area figures', async () => {
      const { phuket, bangTao } = await corridor();
      const project = await createProject({ slug: 'bt', areaId: bangTao.id, status: 'live' });
      const unit = await createUnit({ projectId: project.id, status: 'live' });
      await metricsFor(project.id, unit.id, '2026-07-05', { available: 1, occupied: 1, rental: 250_000 });

      const portfolio = await getPortfolioByArea(db, { from: FROM, to: TO });
      const one = await getAreaPerformance(db, phuket.id, { from: FROM, to: TO });
      const same = portfolio.find((p) => p.areaId === phuket.id);

      // Two code paths, one answer — or the portfolio table and the area page
      // disagree in front of the founder.
      expect(same!.nightsOccupied).toBe(one!.nightsOccupied);
      expect(same!.adrThb).toBe(one!.adrThb);
      expect(same!.projectCount).toBe(one!.projectCount);
      // Empty areas still appear: their absence would read as "no such place".
      expect(portfolio).toHaveLength(4);
    });
  });
});
