import type { PrismaClient } from '@prisma/client';

type ManagedImportReader = Pick<PrismaClient, 'externalMapping' | 'unit'>;

const MANAGED_IMPORT_SYSTEM_KEYS = ['layantara_os', 'yandex_disk_public_media'] as const;

/**
 * Imported portfolio provenance is the release seam for legacy rows that were
 * loaded as draft before public visibility and booking readiness were split.
 * It never makes a row bookable by itself.
 */
export async function managedImportedInventoryIds(db: ManagedImportReader): Promise<{
  projectIds: string[];
  unitIds: string[];
}> {
  const mappings = await db.externalMapping.findMany({
    where: {
      entity_type: { in: ['project', 'unit'] },
      externalSystem: { system_key: { in: [...MANAGED_IMPORT_SYSTEM_KEYS] } },
    },
    select: { entity_type: true, internal_id: true },
  });

  const projectIds = new Set(
    mappings.filter(row => row.entity_type === 'project').map(row => row.internal_id)
  );
  const unitIds = mappings
    .filter(row => row.entity_type === 'unit')
    .map(row => row.internal_id);

  if (unitIds.length) {
    const parents = await db.unit.findMany({
      where: { id: { in: unitIds } },
      select: { projectId: true },
    });
    for (const row of parents) projectIds.add(row.projectId);
  }

  return {
    projectIds: [...projectIds],
    unitIds: [...new Set(unitIds)],
  };
}
