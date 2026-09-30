import type { PrismaClient } from '@prisma/client';

type Copy = { en: string; ru: string; th?: string };
/**
 * Editorial copy migrated from LayantaraOS' home-copy.ts. Creates missing
 * translations only; an editor's existing values always win.
 *
 * The same key convention is supported by every Project Space:
 * project.<slug>.editorial.<field>. This is NOT a new project or inventory seed.
 */
export const LAYANTARA_PROJECT_EDITORIAL: Record<string, Copy> = {
  eyebrow: { en: 'PRIVATE AS A VILLA · EASY AS A RESORT', ru: 'Своя вилла · сервис курорта' },
  headline: { en: 'A Phuket story needs more than a room. It needs a place of its own.', ru: 'Не номер. Своя вилла на Пхукете.' },
  lead: { en: 'Spacious two- and three-bedroom villas, each with a private pool — and resort support when you want it.', ru: 'Две или три спальни, гостиная, кухня и бассейн только для вас. Уборка и помощь курорта — когда нужно.' },
  'benefits.title': { en: 'A private villa, with resort service already in the stay.', ru: 'Приватность виллы и сервис курорта.' },
  'benefit.1.title': { en: 'Your own pool', ru: 'Свой бассейн' },
  'benefit.1.body': { en: 'A private pool for the people in your villa — not a shared hotel pool.', ru: 'Для тех, кто живёт в этом доме. Не общий бассейн отеля.' },
  'benefit.2.title': { en: 'Space to live', ru: 'Пространство для жизни' },
  'benefit.2.body': { en: 'Separate bedrooms, a living room, a kitchen and outdoor space you can use all day.', ru: 'Отдельные спальни, гостиная, кухня и двор. День проходит дома, а не в номере.' },
  'benefit.3.title': { en: 'Near Layan Beach', ru: 'Рядом с пляжем Лаян' },
  'benefit.3.body': { en: 'A quiet northwest Phuket base. Layan, Laguna and Bang Tao are a short drive away.', ru: 'Тихий северо-запад Пхукета. Лаян, Laguna и Bang Tao — недалеко на автомобиле.' },
  'benefit.4.title': { en: 'Resort service', ru: 'Сервис курорта' },
  'benefit.4.body': { en: 'Housekeeping, maintenance help and orders for the stay are part of living here.', ru: 'Уборка, помощь с ремонтом и заказы во время проживания — через команду курорта.' },
  'location.title': { en: 'Northwest Phuket: beach, Laguna and the national park nearby.', ru: 'Северо-запад Пхукета: Лаян, Laguna и природные места рядом.' },
  'location.body': { en: 'Layantara is in Thep Krasattri, inland of the northwest coast. Layan Beach, Laguna Phuket and Bang Tao are reached by road. See the verified map pin before planning an exact route.', ru: 'Layantara находится в Thep Krasattri, в глубине северо-западного побережья. До Лаяна, Laguna и Bang Tao можно доехать по дороге. Точный маршрут уточняйте по подтверждённой геометке.' },
  'groups.title': { en: 'Come together. Keep a door of your own.', ru: 'Быть вместе. И иметь свой отдельный дом.' },
  'groups.body': { en: 'Bring families, friends, teams or retreat groups together across private-pool villas. Each household gets space of its own, with resort support for shared arrangements.', ru: 'Семья, друзья, команды и ретрит-группы могут жить рядом в отдельных виллах с бассейнами. Организационные вопросы помогает решать команда курорта.' },
  'groups.cta': { en: 'Explore villas', ru: 'Смотреть виллы' },
};

export async function seedLayantaraProjectEditorial(db: PrismaClient) {
  const project = await db.project.findUnique({ where: { slug: 'layantara-villas' }, select: { id: true } });
  if (!project) throw new Error('Canonical layantara-villas project is missing; refusing to create another');
  const editor = await db.identity.findFirst({ where: { isAdmin: true }, select: { id: true } });
  if (!editor) throw new Error('An admin identity is required to attribute editorial copy');
  let created = 0;
  for (const [field, locales] of Object.entries(LAYANTARA_PROJECT_EDITORIAL)) {
    const key = `project.layantara-villas.editorial.${field}`;
    const contentKey = await db.contentKey.upsert({
      where: { key },
      create: { key, namespace: 'project', description: `Layantara project editorial: ${field}` },
      update: {},
    });
    for (const [locale, value] of Object.entries(locales)) {
      const prior = await db.translation.findUnique({
        where: { contentKeyId_locale: { contentKeyId: contentKey.id, locale } },
        select: { id: true },
      });
      if (prior) continue;
      await db.translation.create({ data: {
        contentKeyId: contentKey.id, locale, value, status: 'needs_review',
        updatedByIdentityId: editor.id,
      } });
      created++;
    }
  }
  return { projectId: project.id, createdTranslations: created };
}
