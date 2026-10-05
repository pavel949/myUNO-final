export type HomepageSectionKey = 'projects' | 'homes' | 'services' | 'areas';
export type HomepageEntityType = 'project' | 'unit' | 'commercial_offering' | 'service' | 'area';

export interface HomepagePlacementRecord {
  id: string;
  destinationKey: string;
  locale: string | null;
  sectionKey: string;
  entityType: string;
  entityId: string | null;
  position: number;
  visibleFrom: Date | null;
  visibleUntil: Date | null;
  status: string;
}

export function activeHomepagePlacements(
  placements: HomepagePlacementRecord[],
  input: { destinationKey: string; locale: string; sectionKey: HomepageSectionKey; now?: Date },
): HomepagePlacementRecord[] {
  const now = input.now ?? new Date();
  return placements
    .filter((placement) =>
      placement.destinationKey === input.destinationKey &&
      placement.sectionKey === input.sectionKey &&
      placement.status === 'active' &&
      (!placement.locale || placement.locale === input.locale) &&
      (!placement.visibleFrom || placement.visibleFrom <= now) &&
      (!placement.visibleUntil || placement.visibleUntil > now) &&
      Boolean(placement.entityId)
    )
    .sort((a, b) => a.position - b.position);
}

/**
 * Editorial placement changes only order/visibility of already-eligible
 * canonical entities. Unknown/ineligible IDs are ignored and unplaced
 * eligible entities remain available as deterministic fallback.
 */
export function applyHomepagePlacements<T extends { id: string }>(
  items: T[],
  placements: HomepagePlacementRecord[],
  input: {
    destinationKey: string;
    locale: string;
    sectionKey: HomepageSectionKey;
    entityType: HomepageEntityType;
    limit?: number;
  },
): T[] {
  const applicable = activeHomepagePlacements(placements, input)
    .filter((placement) => placement.entityType === input.entityType);
  if (!applicable.length) return typeof input.limit === 'number' ? items.slice(0, input.limit) : items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const placement of applicable) {
    const id = placement.entityId;
    if (!id || seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    ordered.push(item);
  }
  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return typeof input.limit === 'number' ? ordered.slice(0, input.limit) : ordered;
}
