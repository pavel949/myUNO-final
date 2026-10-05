import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const PROJECT_ID = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';
const UNIT_ID = 'layantara-unit-a26f85af-28c5-48d6-8789-eb603b806c8c';

async function main() {
  const apply = process.argv.includes('--apply');
  const unit = await db.unit.findUnique({
    where: { id: UNIT_ID },
    select: {
      id: true,
      name: true,
      projectId: true,
      descriptionKey: true,
      externalMappings: {
        select: { external_id: true, metadata: true, externalSystem: { select: { system_key: true } } },
      },
    },
  });

  if (!unit || unit.projectId !== PROJECT_ID) {
    throw new Error('Layantara A13 reconciliation aborted: expected physical unit is missing');
  }

  const titleKey = unit.descriptionKey?.replace(/\.description$/, '.title') ?? null;
  const title = titleKey
    ? await db.translation.findFirst({
        where: { contentKey: { key: titleKey }, locale: 'en' },
        select: { value: true },
      })
    : null;

  const source = unit.externalMappings.find(row => row.externalSystem.system_key === 'layantara_os');
  const sourceCode =
    source && typeof source.metadata === 'object' && source.metadata
      ? (source.metadata as Record<string, unknown>).unit_code
      : null;

  const evidence = {
    unitId: unit.id,
    currentName: unit.name,
    sourceCode,
    titleKey,
    englishTitle: title?.value ?? null,
    canonicalName: 'Villa A13',
    preservesExternalCode: true,
  };

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', evidence }, null, 2));

  if (!apply) return;

  if (sourceCode !== 'AA' || !title?.value?.startsWith('A13')) {
    throw new Error('Layantara A13 reconciliation refused: source/copy evidence does not match');
  }

  await db.unit.update({
    where: { id: unit.id },
    data: { name: 'Villa A13' },
  });

  console.log(JSON.stringify({ reconciled: true, unitId: unit.id, name: 'Villa A13' }, null, 2));
}

main()
  .finally(async () => db.$disconnect())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
