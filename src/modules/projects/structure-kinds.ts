/** Valid physical hierarchy kinds. Commercial inventory categories are separate. */
export const structureKinds = [
  'phase','cluster','building','tower','wing','floor','block','zone','standalone',
] as const;
export type StructureKind = (typeof structureKinds)[number];

/**
 * Refuse a reparent that would create a physical hierarchy cycle.
 * Only nodes of the already-authorized project may be passed to this function.
 * The API calls this while holding its project-scoped DB advisory lock.
 */
export function assertAcyclicStructureParent(
  nodes: Array<{ id: string; parentId: string | null }>,
  nodeId: string,
  parentId: string | null,
): void {
  if (!parentId) return;
  const byId = new Map(nodes.map(node => [node.id, node.parentId]));
  if (!byId.has(nodeId) || !byId.has(parentId)) {
    throw new Error('Structure node or parent was not found in this project');
  }
  const visited = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === nodeId || visited.has(cursor)) {
      throw new Error('Physical structure cannot contain a parent cycle');
    }
    visited.add(cursor);
    if (!byId.has(cursor)) throw new Error('Parent hierarchy is incomplete');
    cursor = byId.get(cursor) ?? null;
  }
}
