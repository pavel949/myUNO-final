/**
 * Pure ordering and grouping rules for the public homepage read model.
 *
 * No I/O here: the service loads rows, this file decides what the homepage
 * shows first. Ordering uses facts about the inventory (a real cover photo,
 * live inventory, spread across projects) — never a project's display name.
 */

export interface RankableProject {
  id: string;
  name: string;
  coverUrl: string | null;
  liveUnitCount: number;
}

export function rankProjects<T extends RankableProject>(projects: readonly T[]): T[] {
  return [...projects].sort(
    (a, b) =>
      Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)) ||
      b.liveUnitCount - a.liveUnitCount ||
      a.name.localeCompare(b.name)
  );
}

/**
 * Take units round-robin across projects so one project cannot fill the shelf
 * (alphabetical order put a single project's first eight units on the page).
 * Units with a cover photo go first inside each project.
 */
export function interleaveByProject<T extends { projectId: string; coverUrl: string | null }>(
  units: readonly T[],
  limit: number
): T[] {
  const queues = new Map<string, T[]>();
  for (const unit of units) {
    const queue = queues.get(unit.projectId) ?? [];
    queue.push(unit);
    queues.set(unit.projectId, queue);
  }
  for (const queue of queues.values()) {
    queue.sort((a, b) => Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)));
  }
  const result: T[] = [];
  const lanes = [...queues.values()];
  while (result.length < limit && lanes.some((lane) => lane.length)) {
    for (const lane of lanes) {
      const next = lane.shift();
      if (next) result.push(next);
      if (result.length >= limit) break;
    }
  }
  return result;
}

/**
 * Situations are navigation over the one services catalogue, not a second
 * catalogue: each group names catalogue category keys, and a key the catalogue
 * does not have simply contributes nothing.
 */
export const SERVICE_SITUATIONS = [
  { key: 'arrival', categoryKeys: ['transfer', 'car_hire', 'water_delivery'] },
  { key: 'leisure', categoryKeys: ['yacht', 'tours', 'massage_spa', 'chef', 'babysitting'] },
  { key: 'home', categoryKeys: ['cleaning', 'laundry', 'repairs', 'flowers'] },
] as const;

export type ServiceSituationKey = (typeof SERVICE_SITUATIONS)[number]['key'];

export function groupServicesBySituation<T extends { categoryKey: string }>(
  services: readonly T[],
  perGroup = 2
): Array<{ key: ServiceSituationKey; items: T[] }> {
  return SERVICE_SITUATIONS.map((situation) => ({
    key: situation.key,
    items: services
      .filter((service) => (situation.categoryKeys as readonly string[]).includes(service.categoryKey))
      .slice(0, perGroup),
  })).filter((group) => group.items.length > 0);
}
