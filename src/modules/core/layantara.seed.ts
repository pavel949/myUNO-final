import { PrismaClient, Prisma } from '@prisma/client';
import { ensureContentKey, setTranslation } from '@/modules/content';

/**
 * Seed Layantara Resort — the first real project on the platform (LY-4).
 *
 * 39 villas / 94 bedrooms in Bang Tao–Layan, Phuket, built 2018, operated by
 * Ignatev Estate under a hotel licence (legal short-term rentals). Three
 * architectural phases become three style groups; five sellable categories
 * carry the real retail tariff grid as project-scoped config overrides —
 * numbers live in config, never in code (doc 04).
 *
 * Idempotent: project upsert on slug, units upsert on [projectId, name],
 * overrides upsert on [parameterKey, scopeType, scopeId].
 *
 * permittedUseConfirmedAt is set at seed time — a deliberate, founder-
 * authorized exception to the usual admin-gate flow, based on the resort's
 * stated hotel licence. The licence number itself is pending (Q29).
 */

// The real Layantara season calendar (brief 2026-07-28). Absolute category
// rates carry the prices, so every markup stays 0. Peak is a carve-out
// inside high — shortest-range-wins gives it precedence.
const SEASON_CALENDAR = [
  { name: 'shoulder_apr', from: '04-01', to: '04-30', markup_pct: 0 },
  { name: 'low', from: '05-01', to: '09-30', markup_pct: 0 },
  { name: 'shoulder_oct', from: '10-01', to: '10-31', markup_pct: 0 },
  { name: 'high', from: '11-01', to: '03-31', markup_pct: 0 },
  { name: 'peak', from: '12-21', to: '01-10', markup_pct: 0 },
];

interface CategorySpec {
  key: string;
  styleKey: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  labelEn: string;
  labelRu: string;
  labelZh: string;
  // Retail nightly rates, satang (THB × 100) — the brief's grid verbatim
  nightly: Record<string, number>;
  // Flat month price for long stays, satang — brief gives low season only (Q28)
  monthlyLow: number;
}

export const LAYANTARA_CATEGORIES: CategorySpec[] = [
  {
    key: 'standard_2br',
    styleKey: 'phase_1_colonial',
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    labelEn: 'Standard 2-Bedroom Villa',
    labelRu: 'Стандарт, 2 спальни',
    labelZh: '标准双卧别墅',
    nightly: { shoulder_apr: 629400, low: 547900, shoulder_oct: 566400, high: 758600, peak: 986300 },
    monthlyLow: 7200000,
  },
  {
    key: 'superior_2br',
    styleKey: 'phase_2_minimal',
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    labelEn: 'Superior 2-Bedroom Villa',
    labelRu: 'Супериор, 2 спальни',
    labelZh: '高级双卧别墅',
    nightly: { shoulder_apr: 719300, low: 626100, shoulder_oct: 647300, high: 867000, peak: 1127200 },
    monthlyLow: 7200000,
  },
  {
    key: 'standard_3br',
    styleKey: 'phase_1_colonial',
    bedrooms: 3,
    bathrooms: 3,
    maxGuests: 6,
    labelEn: 'Standard 3-Bedroom Villa',
    labelRu: 'Стандарт, 3 спальни',
    labelZh: '标准三卧别墅',
    nightly: { shoulder_apr: 899100, low: 782700, shoulder_oct: 809200, high: 1083900, peak: 1408900 },
    monthlyLow: 11500000,
  },
  {
    key: 'superior_3br',
    styleKey: 'phase_2_minimal',
    bedrooms: 3,
    bathrooms: 3,
    maxGuests: 6,
    labelEn: 'Superior 3-Bedroom Villa',
    labelRu: 'Супериор, 3 спальни',
    labelZh: '高级三卧别墅',
    nightly: { shoulder_apr: 989100, low: 860900, shoulder_oct: 890100, high: 1192200, peak: 1549900 },
    monthlyLow: 11500000,
  },
  {
    key: 'grand_deluxe_3br',
    styleKey: 'garden_continental',
    bedrooms: 3,
    bathrooms: 3,
    maxGuests: 6,
    labelEn: 'Grand Deluxe 3-Bedroom Villa',
    labelRu: 'Гранд Делюкс, 3 спальни',
    labelZh: '豪华三卧别墅',
    nightly: { shoulder_apr: 1079000, low: 939300, shoulder_oct: 971100, high: 1300600, peak: 1690800 },
    monthlyLow: 14000000,
  },
];

const STYLES = [
  { key: 'phase_1_colonial', en: 'Colonial tropical (Phase I)', ru: 'Колониально-тропический (Фаза I)', zh: '殖民热带风格（一期）' },
  { key: 'phase_2_minimal', en: 'Minimalist (Phase II)', ru: 'Минимализм (Фаза II)', zh: '极简风格（二期）' },
  { key: 'garden_continental', en: 'European continental (Garden Zone)', ru: 'Европейский континентальный (Garden Zone)', zh: '欧陆风格（花园区）' },
];

// Villa roster: placeholder numbering by phase until the founder supplies the
// real villa names/numbers (Q29). Counts per the brief: Phase I = 2×std2br +
// 5×std3br, Phase II = 21×sup2br + 3×sup3br, Garden Zone = 8×gd3br.
function villaRoster(): { name: string; categoryKey: string }[] {
  const roster: { name: string; categoryKey: string }[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let i = 1; i <= 2; i++) roster.push({ name: `P1-${pad(i)}`, categoryKey: 'standard_2br' });
  for (let i = 3; i <= 7; i++) roster.push({ name: `P1-${pad(i)}`, categoryKey: 'standard_3br' });
  for (let i = 1; i <= 21; i++) roster.push({ name: `P2-${pad(i)}`, categoryKey: 'superior_2br' });
  for (let i = 22; i <= 24; i++) roster.push({ name: `P2-${pad(i)}`, categoryKey: 'superior_3br' });
  for (let i = 1; i <= 8; i++) roster.push({ name: `G-${pad(i)}`, categoryKey: 'grand_deluxe_3br' });
  return roster;
}

async function upsertProjectOverride(
  db: PrismaClient,
  projectId: string,
  parameterKey: string,
  value: unknown,
  updatedByIdentityId: string
) {
  await db.configOverride.upsert({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey,
        scopeType: 'project',
        scopeId: projectId,
      },
    },
    create: {
      parameterKey,
      scopeType: 'project',
      scopeId: projectId,
      value: value as Prisma.InputJsonValue,
      updatedByIdentityId,
    },
    update: { value: value as Prisma.InputJsonValue },
  });
}

async function seedKey(
  db: PrismaClient,
  identityId: string,
  key: string,
  namespace: string,
  description: string,
  values: { ru: string; en: string; zh?: string },
  status: 'ok' | 'needs_review' = 'ok'
) {
  await ensureContentKey(db, key, namespace, description);
  await setTranslation(db, key, 'ru', values.ru, status, identityId);
  await setTranslation(db, key, 'en', values.en, status, identityId);
  if (values.zh) {
    // zh drafts always ship needs_review until editorially reviewed (doc 05 §2)
    await setTranslation(db, key, 'zh', values.zh, 'needs_review', identityId);
  }
}

export async function seedLayantara(db: PrismaClient) {
  const admin = await db.identity.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    throw new Error('seedLayantara requires an admin identity (run seedDemoData first)');
  }

  // 1. The project. Coordinates are the Layan Beach area — approximate until
  // the founder supplies the exact pin (Q29).
  const project = await db.project.upsert({
    where: { slug: 'layantara' },
    create: {
      slug: 'layantara',
      name: 'Layantara Resort',
      areaLabelKey: 'project.layantara.area',
      descriptionKey: 'project.layantara.description',
      latitude: new Prisma.Decimal('8.0106'),
      longitude: new Prisma.Decimal('98.2965'),
      address: 'Bang Tao–Layan, Cherngtalay, Thalang, Phuket',
      timezone: 'Asia/Bangkok',
      amenityKeys: ['pool', 'wifi', 'parking', 'security_24h', 'kids_friendly'],
      handbookKey: 'project.layantara.handbook',
      status: 'live',
    },
    update: {},
  });

  // 2. The demo project leaves the public catalog (founder decision
  // 2026-07-28): draft status removes it from /projects and search.
  await db.project.updateMany({
    where: { slug: 'ignatev-showcase' },
    data: { status: 'draft' },
  });

  // 3. Project-scoped pricing & catalog config (doc 04): the entire tariff
  // grid lives here, editable in the admin panel without code.
  await upsertProjectOverride(db, project.id, 'pricing.season.calendar', SEASON_CALENDAR, admin.id);
  await upsertProjectOverride(
    db,
    project.id,
    'catalog.unit_categories',
    LAYANTARA_CATEGORIES.map((c) => ({ key: c.key, style_key: c.styleKey, bedrooms: c.bedrooms })),
    admin.id
  );
  const categoryRates: Record<string, unknown> = {};
  for (const c of LAYANTARA_CATEGORIES) {
    categoryRates[c.key] = { nightly: c.nightly, monthly: { low: c.monthlyLow } };
  }
  await upsertProjectOverride(db, project.id, 'pricing.category_rates', categoryRates, admin.id);
  await upsertProjectOverride(db, project.id, 'pricing.early_bird', { min_days_before: 60, pct: 8 }, admin.id);
  // Founder's WhatsApp line (Q16 contact) until a dedicated concierge number exists
  await upsertProjectOverride(db, project.id, 'comms.whatsapp_number', '+66922407355', admin.id);

  // 4. 39 villas. instantBook=false → every booking is a request the manager
  // confirms (the brief's payment story). Base nightly = the category's low
  // rate — a safe fallback if a rate entry is ever removed.
  for (const villa of villaRoster()) {
    const spec = LAYANTARA_CATEGORIES.find((c) => c.key === villa.categoryKey)!;
    await db.unit.upsert({
      where: { projectId_name: { projectId: project.id, name: villa.name } },
      create: {
        projectId: project.id,
        name: villa.name,
        unitType: 'villa',
        categoryKey: spec.key,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        maxGuests: spec.maxGuests,
        addressSupplement: villa.name,
        amenityKeys: ['pool', 'aircon', 'wifi', 'kitchen'],
        baseNightlyThb: spec.nightly.low,
        minNights: 2,
        instantBook: false,
        status: 'live',
        permittedUseConfirmedAt: new Date(),
      },
      update: {
        categoryKey: spec.key,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        maxGuests: spec.maxGuests,
        baseNightlyThb: spec.nightly.low,
      },
    });
  }

  // 5. Content: project copy (RU/EN from the brief = ok; zh drafts
  // needs_review), category and style labels.
  await seedKey(db, admin.id, 'project.layantara.area', 'project', 'Layantara: area label', {
    ru: 'Банг Тао — Лаян, Пхукет',
    en: 'Bang Tao–Layan, Phuket',
    zh: '普吉岛邦涛-拉扬',
  });
  await seedKey(db, admin.id, 'project.layantara.description', 'project', 'Layantara: landing description', {
    ru: 'Лицензированный резорт на 39 вилл в Лаяне, Пхукет. Три архитектурных стиля, сервис оператора Ignatev Estate, легальная краткосрочная аренда по гостиничной лицензии.',
    en: 'Licensed 39-villa resort in Layan, Phuket. Three architectural styles, service by Ignatev Estate, legal short-term rentals under a hotel licence.',
    zh: '普吉岛拉扬持牌39栋别墅度假村。三种建筑风格，由Ignatev Estate运营，持酒店牌照合法短租。',
  });
  await seedKey(
    db,
    admin.id,
    'project.layantara.handbook',
    'project',
    'Layantara: guest handbook (rich)',
    {
      ru: 'Справочник резиденции готовится — обратитесь к консьержу по любым вопросам.',
      en: 'The residence handbook is being prepared — ask the concierge about anything you need.',
    },
    'needs_review'
  );
  await seedKey(db, admin.id, 'project.layantara.licence', 'project', 'Layantara: trust band licence line', {
    ru: 'Лицензированный резорт (гостиничная лицензия) — легальная посуточная аренда.',
    en: 'Licensed resort (hotel licence) — legal short-term rentals.',
    zh: '持牌度假村（酒店牌照）—— 合法短租。',
  });

  for (const c of LAYANTARA_CATEGORIES) {
    await seedKey(
      db,
      admin.id,
      `catalog.unit_categories.${c.key}.label`,
      'catalog',
      `Unit category label: ${c.key}`,
      { ru: c.labelRu, en: c.labelEn, zh: c.labelZh }
    );
  }
  for (const s of STYLES) {
    await seedKey(db, admin.id, `catalog.styles.${s.key}.label`, 'catalog', `Style label: ${s.key}`, {
      ru: s.ru,
      en: s.en,
      zh: s.zh,
    });
  }

  // 6. Concierge showcase: the operator as provider + the brief's services.
  // Prices/terms are placeholders on the quote model until the founder
  // supplies real ones (Q29) — quote-priced services never charge a number.
  const concierge = await db.provider.upsert({
    where: { id: 'layantara-concierge' },
    create: {
      id: 'layantara-concierge',
      name: 'Layantara Concierge by Ignatev Estate',
      description: 'Resort concierge: transfers, dining, boats, and daily needs',
      contactEmail: 'pavel@ignatevestate.com',
      contactPhone: '+66922407355',
      status: 'active',
      vetted_at: new Date(),
    },
    update: { status: 'active' },
  });

  const conciergeServices = [
    { id: 'layantara-svc-transfer', categoryKey: 'transfer', title: 'Airport transfer', description: 'Private car from/to Phuket International Airport' },
    { id: 'layantara-svc-breakfast', categoryKey: 'chef', title: 'Floating breakfast', description: 'Floating breakfast served in your villa pool' },
    { id: 'layantara-svc-yacht', categoryKey: 'yacht', title: 'Yacht charter', description: 'Private day charters around Phuket and the islands' },
    { id: 'layantara-svc-shuttle', categoryKey: 'transfer', title: 'Beach shuttle', description: 'Scheduled shuttle to Layan and Bang Tao beaches' },
    { id: 'layantara-svc-grocery', categoryKey: 'water_delivery', title: 'Welcome grocery pack', description: 'Pre-arrival grocery stocking for your villa' },
  ];
  for (const svc of conciergeServices) {
    await db.service.upsert({
      where: { id: svc.id },
      create: {
        id: svc.id,
        provider_id: concierge.id,
        categoryKey: svc.categoryKey,
        title: svc.title,
        description: svc.description,
        priceModel: 'quote',
        basePriceThb: null,
        status: 'active',
      },
      update: { status: 'active' },
    });
  }

  console.log('✓ Layantara seeded: project, 39 villas, tariff grid, content, concierge');
  return project;
}
