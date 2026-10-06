import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const PROJECT_ID = 'layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de';

const EXPECTED_UNITS = [
  'V1','V2','V3','V4','V5','V6','V7',
  'A8','A9','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19',
  'B20','B21','B22','B23','B24','B25','B26','B27','B28','B29',
  'GUY1','GUY2',
  'G1','G2','G3','G4','G5','G6','G7','G8',
] as const;

const EXPECTED_CATEGORIES = [
  '2BR_GARDEN_RETREAT',
  '2BR_SUPERIOR',
  '2BR_GRAND_DELUXE',
  '3BR_GARDEN_RETREAT',
  '3BR_SUPERIOR',
  '3BR_GRAND_DELUXE_G1_G5',
  '3BR_GRAND_DELUXE_G6_G7',
  '3BR_GRAND_DELUXE_G8',
] as const;

function codeFromName(name: string) {
  return name.replace(/^Villa\s+/i, '').toUpperCase();
}

async function translationExists(key: string, locale: string) {
  return Boolean(await db.translation.findFirst({
    where: {
      locale,
      value: { not: '' },
      contentKey: { key },
    },
    select: { id: true },
  }));
}

async function main() {
  const units = await db.unit.findMany({
    where: { projectId: PROJECT_ID },
    select: { id: true, name: true, descriptionKey: true, inventoryCategoryId: true },
    orderBy: { name: 'asc' },
  });
  const categories = await db.inventoryCategory.findMany({
    where: { projectId: PROJECT_ID },
    select: { id: true, categoryKey: true, name: true },
    orderBy: { categoryKey: 'asc' },
  });

  const failures: string[] = [];

  if (units.length !== 39) failures.push(`Expected 39 units, found ${units.length}`);
  if (categories.length !== 8) failures.push(`Expected 8 categories, found ${categories.length}`);

  const actualCodes = new Set(units.map(unit => codeFromName(unit.name)));
  for (const code of EXPECTED_UNITS) {
    if (!actualCodes.has(code)) failures.push(`UNIT_NOT_FOUND: ${code}`);
  }
  for (const unit of units) {
    if (!unit.descriptionKey) {
      failures.push(`MISSING_DESCRIPTION_KEY: ${unit.name}`);
      continue;
    }
    const titleKey = unit.descriptionKey.replace(/\.description$/, '.title');
    for (const locale of ['en', 'ru']) {
      if (!(await translationExists(titleKey, locale))) {
        failures.push(`MISSING_UNIT_TITLE_${locale.toUpperCase()}: ${unit.name}`);
      }
      if (!(await translationExists(unit.descriptionKey, locale))) {
        failures.push(`MISSING_UNIT_DESCRIPTION_${locale.toUpperCase()}: ${unit.name}`);
      }
    }
  }

  const actualCategories = new Set(categories.map(category => category.categoryKey));
  for (const key of EXPECTED_CATEGORIES) {
    if (!actualCategories.has(key)) failures.push(`CATEGORY_NOT_FOUND: ${key}`);
  }
  for (const category of categories) {
    const root = `layantara.category.${category.id.replace(/^layantara-category-/, '')}`;
    for (const locale of ['en', 'ru', 'th']) {
      if (!(await translationExists(`${root}.title`, locale))) {
        failures.push(`MISSING_CATEGORY_TITLE_${locale.toUpperCase()}: ${category.name}`);
      }
      if (!(await translationExists(`${root}.description`, locale))) {
        failures.push(`MISSING_CATEGORY_DESCRIPTION_${locale.toUpperCase()}: ${category.name}`);
      }
    }
  }

  const result = {
    ok: failures.length === 0,
    units: units.length,
    categories: categories.length,
    expectedUnits: EXPECTED_UNITS.length,
    expectedCategories: EXPECTED_CATEGORIES.length,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .finally(async () => db.$disconnect())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
