import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const apply = process.argv.includes('--apply');

const PROJECT_SLUG = 'layantara-villas';

const FEATURE_KEY_BY_LEGACY_LABEL: Record<string, string> = {
  'Private pool': 'private_pool',
  'Equipped kitchen': 'equipped_kitchen',
  'Comfortable indoor-outdoor living': 'indoor_outdoor_living',
  'Tropical garden alongside the pool': 'tropical_garden_poolside',
  'Peaceful garden retreat': 'peaceful_garden_retreat',
  'Spacious tropical garden': 'spacious_tropical_garden',
};

function isCanonicalFactKey(value: string) {
  return /^[a-z0-9_]+$/.test(value);
}

async function hasTranslation(key: string, locale: string) {
  const row = await db.translation.findFirst({
    where: { contentKey: { key }, locale },
    select: { id: true },
  });
  return Boolean(row);
}

async function main() {
  const project = await db.project.findUnique({
    where: { slug: PROJECT_SLUG },
    select: {
      id: true,
      slug: true,
      name: true,
      units: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          descriptionKey: true,
          unitFeatures: true,
          inventoryCategoryId: true,
        },
      },
      inventoryCategories: {
        orderBy: { categoryKey: 'asc' },
        select: { id: true, categoryKey: true, name: true },
      },
    },
  });

  if (!project) throw new Error('Canonical Layantara project not found');
  if (project.units.length !== 39) {
    throw new Error(`Expected 39 Layantara physical villas, found ${project.units.length}`);
  }
  if (project.inventoryCategories.length !== 8) {
    throw new Error(`Expected 8 Layantara inventory categories, found ${project.inventoryCategories.length}`);
  }

  const unitCopyGaps: string[] = [];
  for (const unit of project.units) {
    if (!unit.descriptionKey) {
      unitCopyGaps.push(`${unit.name}: missing descriptionKey`);
      continue;
    }
    const titleKey = unit.descriptionKey.replace(/\.description$/, '.title');
    for (const locale of ['en', 'ru']) {
      if (!(await hasTranslation(unit.descriptionKey, locale))) {
        unitCopyGaps.push(`${unit.name}: missing ${locale} description`);
      }
      if (!(await hasTranslation(titleKey, locale))) {
        unitCopyGaps.push(`${unit.name}: missing ${locale} title`);
      }
    }
  }

  const categoryCopyGaps: string[] = [];
  for (const category of project.inventoryCategories) {
    const sourcePrefix = 'layantara-category-';
    const root = category.id.startsWith(sourcePrefix)
      ? `layantara.category.${category.id.slice(sourcePrefix.length)}`
      : `project.${project.slug}.category.${category.categoryKey}`;

    for (const suffix of ['title', 'description']) {
      for (const locale of ['en', 'ru', 'th']) {
        const key = `${root}.${suffix}`;
        if (!(await hasTranslation(key, locale))) {
          categoryCopyGaps.push(`${category.categoryKey}: missing ${locale} ${suffix}`);
        }
      }
    }
  }

  if (unitCopyGaps.length || categoryCopyGaps.length) {
    console.error(JSON.stringify({ unitCopyGaps, categoryCopyGaps }, null, 2));
    throw new Error('Layantara content reconciliation failed: copy gaps remain');
  }

  const aa = project.units.find(unit => unit.name === 'Villa AA');
  const a13 = project.units.find(unit => unit.name === 'Villa A13');
  if (aa && a13) throw new Error('Both Villa AA and Villa A13 exist; refusing automatic rename');

  const featureChanges = project.units.map(unit => {
    const normalized = unit.unitFeatures.map(feature => {
      if (isCanonicalFactKey(feature)) return feature;
      const mapped = FEATURE_KEY_BY_LEGACY_LABEL[feature];
      if (!mapped) {
        throw new Error(`Unknown legacy unit feature on ${unit.name}: ${feature}`);
      }
      return mapped;
    });
    return {
      id: unit.id,
      name: unit.name,
      before: unit.unitFeatures,
      after: normalized,
      changed: JSON.stringify(unit.unitFeatures) !== JSON.stringify(normalized),
    };
  });

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    project: { id: project.id, slug: project.slug, name: project.name },
    units: project.units.length,
    categories: project.inventoryCategories.length,
    unitCopy: '39/39 EN+RU title+description verified',
    categoryCopy: '8/8 EN+RU+TH title+description verified',
    rename: aa ? 'Villa AA -> Villa A13' : 'already reconciled',
    featureRowsToNormalize: featureChanges.filter(row => row.changed).length,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!apply) {
    console.log('DRY RUN ONLY. Re-run with --apply to reconcile name and canonical feature keys.');
    return;
  }

  await db.$transaction(async tx => {
    if (aa) {
      await tx.unit.update({ where: { id: aa.id }, data: { name: 'Villa A13' } });
    }
    for (const row of featureChanges) {
      if (!row.changed) continue;
      await tx.unit.update({ where: { id: row.id }, data: { unitFeatures: row.after } });
    }
  });

  const after = await db.unit.findMany({
    where: { projectId: project.id },
    select: { name: true, unitFeatures: true },
    orderBy: { name: 'asc' },
  });

  if (!after.some(unit => unit.name === 'Villa A13') || after.some(unit => unit.name === 'Villa AA')) {
    throw new Error('Villa A13 name reconciliation did not persist');
  }
  const invalidFeatures = after.flatMap(unit =>
    unit.unitFeatures.filter(feature => !isCanonicalFactKey(feature)).map(feature => `${unit.name}: ${feature}`)
  );
  if (invalidFeatures.length) {
    throw new Error(`Non-canonical unit features remain: ${invalidFeatures.join(', ')}`);
  }

  console.log(JSON.stringify({
    applied: true,
    villaName: 'A13 verified',
    featureRowsCanonical: after.length,
    contentSource: 'ContentKey/Translation',
  }, null, 2));
}

main()
  .finally(async () => db.$disconnect())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
