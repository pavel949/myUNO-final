import { PrismaClient, Prisma, AreaStatus } from '@prisma/client';

/**
 * Areas — a place inventory is described by.
 *
 * A location used to be `Project.areaLabelKey`, a content key: a string to
 * display, not a thing to ask questions about. Areas do the two jobs the
 * founder named — **browse** (an area page, a search filter, "near here") and
 * **reporting** (occupancy and revenue across a region) — over myUNO's own
 * inventory.
 *
 * The tree is walked in memory rather than with a recursive CTE. Areas number
 * in the tens, not the millions, and one small query that everything else
 * reasons about beats a clever one nobody can follow. Every walk carries a
 * visited set: a cycle would otherwise hang the request rather than fail it.
 */

export interface AreaNode {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string | null;
  parentId: string | null;
  status: AreaStatus;
  sort: number;
}

export interface AreaTreeNode extends AreaNode {
  children: AreaTreeNode[];
}

/** Siblings order by `sort`, then slug — never by insertion, which is arbitrary. */
function bySortThenSlug(a: AreaNode, b: AreaNode): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

export async function listAreas(
  db: PrismaClient,
  opts: { status?: AreaStatus } = {}
): Promise<AreaNode[]> {
  const rows = await db.area.findMany({
    where: opts.status ? { status: opts.status } : {},
    select: {
      id: true,
      slug: true,
      nameKey: true,
      descriptionKey: true,
      parentId: true,
      status: true,
      sort: true,
    },
  });
  return rows.sort(bySortThenSlug);
}

/**
 * The areas beneath `areaId`, including itself.
 *
 * This is what makes a hierarchy worth having: a report for "the west coast"
 * covers every beach under it without anyone restating the list. Returns just
 * the id when the area has no children, and an empty array when it does not
 * exist — an unknown area reports nothing rather than everything, because
 * silently widening a report to the whole portfolio is the dangerous failure.
 */
export function collectDescendantIds(areas: readonly AreaNode[], areaId: string): string[] {
  if (!areas.some((a) => a.id === areaId)) return [];

  const childrenByParent = new Map<string, AreaNode[]>();
  for (const area of areas) {
    if (!area.parentId) continue;
    const siblings = childrenByParent.get(area.parentId) ?? [];
    siblings.push(area);
    childrenByParent.set(area.parentId, siblings);
  }

  const collected: string[] = [];
  const visited = new Set<string>();
  const queue = [areaId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    // A cycle would loop forever; a visited set turns that into a finite,
    // wrong-but-terminating answer instead of a hung request.
    if (visited.has(current)) continue;
    visited.add(current);
    collected.push(current);
    for (const child of childrenByParent.get(current) ?? []) queue.push(child.id);
  }

  return collected;
}

/** Root-down tree, for a nav or a picker. Orphans (parent since removed) surface as roots. */
export function buildAreaTree(areas: readonly AreaNode[]): AreaTreeNode[] {
  const byId = new Map<string, AreaTreeNode>(
    areas.map((a) => [a.id, { ...a, children: [] }])
  );
  const roots: AreaTreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const sortDeep = (nodes: AreaTreeNode[]): AreaTreeNode[] => {
    nodes.sort(bySortThenSlug);
    for (const node of nodes) sortDeep(node.children);
    return nodes;
  };

  return sortDeep(roots);
}

/**
 * Whether making `parentId` the parent of `areaId` would form a cycle.
 *
 * Walks up from the proposed parent looking for the area itself. Without this,
 * "Phuket is inside Bang Tao is inside Phuket" is a legal pair of writes, and
 * every later tree walk pays for it.
 */
export function wouldFormCycle(
  areas: readonly AreaNode[],
  areaId: string,
  parentId: string | null
): boolean {
  if (!parentId) return false;
  if (parentId === areaId) return true;

  const byId = new Map(areas.map((a) => [a.id, a]));
  const seen = new Set<string>();
  let cursor: string | null = parentId;

  while (cursor) {
    if (cursor === areaId) return true;
    if (seen.has(cursor)) return true; // already-broken data; refuse to add to it
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }

  return false;
}

export interface SaveAreaInput {
  slug: string;
  nameKey: string;
  descriptionKey?: string | null;
  parentId?: string | null;
  status?: AreaStatus;
  sort?: number;
}

export async function createArea(db: PrismaClient, input: SaveAreaInput) {
  if (input.parentId) {
    const areas = await listAreas(db);
    if (!areas.some((a) => a.id === input.parentId)) {
      throw new Error('Parent area not found');
    }
  }
  return db.area.create({ data: normaliseInput(input) });
}

export async function updateArea(
  db: PrismaClient,
  areaId: string,
  input: Partial<SaveAreaInput>
) {
  if (input.parentId !== undefined) {
    const areas = await listAreas(db);
    if (input.parentId && !areas.some((a) => a.id === input.parentId)) {
      throw new Error('Parent area not found');
    }
    if (wouldFormCycle(areas, areaId, input.parentId)) {
      const err = new Error('An area cannot be placed inside itself');
      (err as { code?: string }).code = 'AREA_CYCLE';
      throw err;
    }
  }
  return db.area.update({ where: { id: areaId }, data: normaliseInput(input) });
}

function normaliseInput(input: Partial<SaveAreaInput>) {
  const data: Prisma.AreaUncheckedCreateInput = {} as Prisma.AreaUncheckedCreateInput;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.nameKey !== undefined) data.nameKey = input.nameKey;
  if (input.descriptionKey !== undefined) data.descriptionKey = input.descriptionKey;
  if (input.parentId !== undefined) data.parentId = input.parentId;
  if (input.status !== undefined) data.status = input.status;
  if (input.sort !== undefined) data.sort = input.sort;
  return data;
}

/**
 * Which label a project shows for where it is.
 *
 * The area wins when one is set, so two projects in Bang Tao cannot name Bang
 * Tao differently. The project's own `areaLabelKey` is the fallback for
 * projects not yet assigned, and becomes dead once every project has an area.
 */
export function resolveAreaLabelKey(project: {
  areaLabelKey: string;
  area?: { nameKey: string } | null;
}): string {
  return project.area?.nameKey ?? project.areaLabelKey;
}

// --- Browse ---------------------------------------------------------------

/**
 * An area page: the area, its children, and the live projects in it or beneath
 * it. Draft areas resolve to null for the public — an area with one project is
 * a project, not a destination.
 */
export async function getAreaForBrowse(db: PrismaClient, slug: string) {
  const area = await db.area.findUnique({ where: { slug } });
  if (!area || area.status !== 'live') return null;

  const areas = await listAreas(db);
  const ids = collectDescendantIds(areas, area.id);

  const projects = await db.project.findMany({
    where: { areaId: { in: ids }, status: 'live' },
    select: {
      id: true,
      slug: true,
      name: true,
      areaLabelKey: true,
      latitude: true,
      longitude: true,
      coverMediaId: true,
      area: { select: { nameKey: true } },
    },
    orderBy: { name: 'asc' },
  });

  const children = areas
    .filter((a) => a.parentId === area.id && a.status === 'live')
    .sort(bySortThenSlug);

  return { area, children, projects };
}

/** Every area with a live project under it, for a browse index or sitemap. */
export async function listBrowsableAreas(db: PrismaClient) {
  const areas = await listAreas(db, { status: 'live' });
  if (areas.length === 0) return [];

  const counts = await db.project.groupBy({
    by: ['areaId'],
    where: { status: 'live', areaId: { not: null } },
    _count: { _all: true },
  });
  const directCount = new Map(counts.map((c) => [c.areaId as string, c._count._all]));

  return areas
    .map((area) => ({
      ...area,
      // Its own projects plus everything beneath it: a coast with no projects
      // directly attached is still browsable if its beaches have some.
      projectCount: collectDescendantIds(areas, area.id).reduce(
        (sum, id) => sum + (directCount.get(id) ?? 0),
        0
      ),
    }))
    .filter((a) => a.projectCount > 0);
}

// --- Reporting ------------------------------------------------------------

export interface AreaPerformance {
  areaId: string;
  slug: string;
  nameKey: string;
  projectCount: number;
  nightsAvailable: number;
  nightsOccupied: number;
  rentalRevenueThb: number;
  serviceRevenueThb: number;
  /** Null when nothing was available — no denominator, so no rate to state. */
  occupancyPct: number | null;
  /** Average daily rate over occupied nights. Null when nothing was occupied. */
  adrThb: number | null;
}

/**
 * Performance for one area over a date window, including everything beneath it.
 *
 * Occupancy and ADR are returned as **null** rather than 0 when their
 * denominator is empty. A region with no inventory yet is not a region at 0%
 * occupancy, and a dashboard that cannot tell those apart will report a
 * catastrophe that is really an absence.
 */
export async function getAreaPerformance(
  db: PrismaClient,
  areaId: string,
  range: { from: Date; to: Date }
): Promise<AreaPerformance | null> {
  const areas = await listAreas(db);
  const area = areas.find((a) => a.id === areaId);
  if (!area) return null;

  const ids = collectDescendantIds(areas, areaId);
  const projects = await db.project.findMany({
    where: { areaId: { in: ids } },
    select: { id: true },
  });

  const empty: AreaPerformance = {
    areaId: area.id,
    slug: area.slug,
    nameKey: area.nameKey,
    projectCount: projects.length,
    nightsAvailable: 0,
    nightsOccupied: 0,
    rentalRevenueThb: 0,
    serviceRevenueThb: 0,
    occupancyPct: null,
    adrThb: null,
  };
  if (projects.length === 0) return empty;

  const totals = await db.metricDaily.aggregate({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      date: { gte: range.from, lte: range.to },
    },
    _sum: {
      nightsAvailable: true,
      nightsOccupied: true,
      rentalRevenueCents: true,
      serviceOrderRevenueCents: true,
    },
  });

  const nightsAvailable = totals._sum.nightsAvailable ?? 0;
  const nightsOccupied = totals._sum.nightsOccupied ?? 0;
  const rentalRevenueThb = totals._sum.rentalRevenueCents ?? 0;

  return {
    ...empty,
    nightsAvailable,
    nightsOccupied,
    rentalRevenueThb,
    serviceRevenueThb: totals._sum.serviceOrderRevenueCents ?? 0,
    occupancyPct:
      nightsAvailable > 0
        ? Math.round((nightsOccupied / nightsAvailable) * 1000) / 10
        : null,
    adrThb: nightsOccupied > 0 ? Math.round(rentalRevenueThb / nightsOccupied) : null,
  };
}

/**
 * Every area's performance, for the portfolio view.
 *
 * Three queries regardless of how many areas there are, rather than three per
 * area: the descendant rollup is arithmetic over one metrics result, not a
 * round trip each. Areas with no inventory are included, reporting nulls —
 * their absence from a portfolio table would read as "no such place".
 */
export async function getPortfolioByArea(
  db: PrismaClient,
  range: { from: Date; to: Date }
): Promise<AreaPerformance[]> {
  const areas = await listAreas(db);
  if (areas.length === 0) return [];

  const projects = await db.project.findMany({
    where: { areaId: { not: null } },
    select: { id: true, areaId: true },
  });

  const metrics = await db.metricDaily.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projects.map((p) => p.id) },
      date: { gte: range.from, lte: range.to },
    },
    _sum: {
      nightsAvailable: true,
      nightsOccupied: true,
      rentalRevenueCents: true,
      serviceOrderRevenueCents: true,
    },
  });
  const metricsByProject = new Map(metrics.map((m) => [m.projectId, m._sum]));

  const projectsByArea = new Map<string, string[]>();
  for (const project of projects) {
    const list = projectsByArea.get(project.areaId as string) ?? [];
    list.push(project.id);
    projectsByArea.set(project.areaId as string, list);
  }

  return areas.map((area) => {
    const projectIds = collectDescendantIds(areas, area.id).flatMap(
      (id) => projectsByArea.get(id) ?? []
    );

    let nightsAvailable = 0;
    let nightsOccupied = 0;
    let rentalRevenueThb = 0;
    let serviceRevenueThb = 0;
    for (const projectId of projectIds) {
      const sums = metricsByProject.get(projectId);
      if (!sums) continue;
      nightsAvailable += sums.nightsAvailable ?? 0;
      nightsOccupied += sums.nightsOccupied ?? 0;
      rentalRevenueThb += sums.rentalRevenueCents ?? 0;
      serviceRevenueThb += sums.serviceOrderRevenueCents ?? 0;
    }

    return {
      areaId: area.id,
      slug: area.slug,
      nameKey: area.nameKey,
      projectCount: projectIds.length,
      nightsAvailable,
      nightsOccupied,
      rentalRevenueThb,
      serviceRevenueThb,
      occupancyPct:
        nightsAvailable > 0
          ? Math.round((nightsOccupied / nightsAvailable) * 1000) / 10
          : null,
      adrThb: nightsOccupied > 0 ? Math.round(rentalRevenueThb / nightsOccupied) : null,
    };
  });
}
