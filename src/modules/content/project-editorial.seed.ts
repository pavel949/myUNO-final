import type { PrismaClient } from '@prisma/client';

type Copy = { en: string; ru: string; th: string };
/**
 * Public resort story for the canonical Layantara Project Space.
 * Copy is translated here; live project, categories, homes, amenities,
 * services and booking actions continue to come from the shared platform.
 */
export const LAYANTARA_PROJECT_EDITORIAL: Record<string, Copy> = {
  eyebrow: {
    en: 'PRIVATE POOL VILLAS · LAYAN, PHUKET',
    ru: 'Виллы с личным бассейном · Лаян, Пхукет',
    th: 'พูลวิลล่าส่วนตัว · ลายัน ภูเก็ต',
  },
  headline: {
    en: 'Your own villa. Room for everyone. A resort team close by.',
    ru: 'Своя вилла. Место для всех. Команда курорта рядом.',
    th: 'วิลล่าส่วนตัว พื้นที่สำหรับทุกคน พร้อมทีมรีสอร์ตคอยดูแล',
  },
  lead: {
    en: 'Choose a two- or three-bedroom home with its own pool and garden, separate en-suite bedrooms, living and dining space, and a fully equipped kitchen. Find your villa, check the details and send a stay enquiry in one place.',
    ru: 'Выберите виллу с двумя или тремя спальнями, собственным бассейном и садом, отдельными спальнями с ванными комнатами, гостиной и кухней. Здесь можно сравнить категории, посмотреть характеристики и отправить запрос на проживание.',
    th: 'เลือกบ้านพักแบบสองหรือสามห้องนอนพร้อมสระว่ายน้ำและสวนส่วนตัว ห้องนอนพร้อมห้องน้ำในตัว พื้นที่นั่งเล่นและรับประทานอาหาร รวมถึงครัวพร้อมอุปกรณ์ เลือกวิลล่า ดูรายละเอียด และส่งคำขอเข้าพักได้ในที่เดียว',
  },
  'benefits.title': {
    en: 'A private home with the ease of a resort stay.',
    ru: 'Приватность собственного дома и удобство отдыха на курорте.',
    th: 'ความเป็นส่วนตัวของบ้าน พร้อมความสะดวกสบายแบบรีสอร์ต',
  },
  'benefit.1.title': {
    en: 'A pool and garden of your own',
    ru: 'Собственные бассейн и сад',
    th: 'สระว่ายน้ำและสวนส่วนตัว',
  },
  'benefit.1.body': {
    en: 'Every villa opens to its own private pool and tropical greenery, giving your group a quiet place to spend time together.',
    ru: 'У каждой виллы — собственный бассейн и тропический сад: у вашей компании есть личное пространство для отдыха.',
    th: 'วิลล่าแต่ละหลังมีสระว่ายน้ำส่วนตัวและพื้นที่สีเขียวเขตร้อน ให้ทุกคนได้พักผ่อนร่วมกันอย่างเป็นส่วนตัว',
  },
  'benefit.2.title': {
    en: 'Space that works for a group',
    ru: 'Пространство для всей компании',
    th: 'พื้นที่สำหรับทุกคนในกลุ่ม',
  },
  'benefit.2.body': {
    en: 'Two- and three-bedroom layouts pair en-suite bedrooms with a living and dining area and an equipped kitchen.',
    ru: 'Планировки с двумя и тремя спальнями сочетают отдельные спальни с ванными комнатами, общую гостиную и столовую, а также оборудованную кухню.',
    th: 'มีแบบสองและสามห้องนอน พร้อมห้องน้ำในตัว พื้นที่นั่งเล่นและรับประทานอาหาร รวมถึงครัวพร้อมอุปกรณ์',
  },
  'benefit.3.title': {
    en: 'A quieter base near Layan and Laguna',
    ru: 'Спокойная база рядом с Лаяном и Laguna',
    th: 'ที่พักสงบใกล้หาดลายันและลากูน่า',
  },
  'benefit.3.body': {
    en: 'Stay on Phuket’s northwest coast with road access to Layan Beach, Laguna Phuket, Bang Tao dining and the island’s outdoor attractions.',
    ru: 'Остановитесь на северо-западе Пхукета. До пляжа Лаян, Laguna Phuket, ресторанов Банг Тао и природных достопримечательностей можно доехать по дороге.',
    th: 'พักผ่อนทางตะวันตกเฉียงเหนือของภูเก็ต เดินทางโดยรถยนต์ไปหาดลายัน ลากูน่าภูเก็ต ร้านอาหารย่านบางเทา และแหล่งท่องเที่ยวธรรมชาติได้',
  },
  'benefit.4.title': {
    en: 'Resort support around your stay',
    ru: 'Поддержка команды курорта',
    th: 'ทีมรีสอร์ตพร้อมช่วยเหลือ',
  },
  'benefit.4.body': {
    en: 'On-site resort support and 24-hour security add reassurance while you keep the privacy and space of a standalone villa.',
    ru: 'Команда курорта на месте и круглосуточная охрана помогают чувствовать себя спокойнее, сохраняя приватность и пространство отдельной виллы.',
    th: 'มีทีมรีสอร์ตประจำพื้นที่และระบบรักษาความปลอดภัยตลอด 24 ชั่วโมง พร้อมคงความเป็นส่วนตัวและพื้นที่กว้างขวางของวิลล่า',
  },
  'location.title': {
    en: 'A northwest Phuket address, close to Layan and Laguna.',
    ru: 'Северо-запад Пхукета — рядом с Лаяном и Laguna.',
    th: 'ทำเลทางตะวันตกเฉียงเหนือของภูเก็ต ใกล้ลายันและลากูน่า',
  },
  'location.body': {
    en: 'Layantara is in Thep Krasattri, Thalang. Layan Beach, Laguna Phuket and Bang Tao are reached by road. Check the project map for the verified pin and plan your route from there.',
    ru: 'Layantara находится в районе Тхеп Красаттри, Таланг. До пляжа Лаян, Laguna Phuket и Банг Тао можно добраться по дороге. Проверьте подтверждённую геометку проекта и планируйте маршрут по карте.',
    th: 'Layantara ตั้งอยู่ในตำบลเทพกระษัตรี อำเภอถลาง สามารถเดินทางโดยรถยนต์ไปหาดลายัน ลากูน่าภูเก็ต และบางเทา ตรวจสอบหมุดตำแหน่งที่ยืนยันแล้วบนแผนที่โครงการก่อนวางแผนเส้นทาง',
  },
  'groups.title': {
    en: 'Come together. Keep a door of your own.',
    ru: 'Будьте вместе. У каждого — своё пространство.',
    th: 'พักผ่อนด้วยกัน พร้อมพื้นที่ส่วนตัวของแต่ละคน',
  },
  'groups.body': {
    en: 'Families, friends and small teams can stay across neighbouring private-pool villas. Share the occasion, then return to your own home and garden.',
    ru: 'Семьи, друзья и небольшие команды могут разместиться в соседних виллах с личными бассейнами. Проводите время вместе, а затем возвращайтесь в свой дом и сад.',
    th: 'ครอบครัว เพื่อน และทีมขนาดเล็กสามารถพักในวิลล่าสระส่วนตัวที่อยู่ใกล้กัน ใช้เวลาร่วมกัน แล้วกลับไปพักผ่อนในบ้านและสวนของตนเอง',
  },
  'groups.cta': {
    en: 'Explore villa categories',
    ru: 'Смотреть категории вилл',
    th: 'ดูประเภทวิลล่า',
  },
};

// Upgrade only the original imported copy. Any translation already edited by
// a human is preserved and remains authoritative.
const LEGACY: Record<string, Partial<Copy>> = {
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
  let createdTranslations = 0;
  let upgradedOriginalTranslations = 0;
  for (const [field, locales] of Object.entries(LAYANTARA_PROJECT_EDITORIAL)) {
    const key = `project.layantara-villas.editorial.${field}`;
    const contentKey = await db.contentKey.upsert({
      where: { key },
      create: { key, namespace: 'project', description: `Layantara project editorial: ${field}` },
      update: {},
    });
    for (const [locale, value] of Object.entries(locales) as Array<[keyof Copy, string]>) {
      const prior = await db.translation.findUnique({
        where: { contentKeyId_locale: { contentKeyId: contentKey.id, locale } },
        select: { id: true, value: true },
      });
      if (!prior) {
        await db.translation.create({ data: {
          contentKeyId: contentKey.id, locale, value, status: 'needs_review',
          updatedByIdentityId: editor.id,
        } });
        createdTranslations++;
        continue;
      }
      const oldValue = LEGACY[field]?.[locale];
      if (oldValue && prior.value === oldValue) {
        await db.translation.update({
          where: { id: prior.id },
          data: { value, status: 'needs_review', updatedByIdentityId: editor.id },
        });
        upgradedOriginalTranslations++;
      }
    }
  }
  return { projectId: project.id, createdTranslations, upgradedOriginalTranslations };
}
