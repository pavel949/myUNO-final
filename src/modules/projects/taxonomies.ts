/**
 * Canonical Property Data System Taxonomies & Localized Dictionary
 *
 * Provides stable machine keys and trilingual (EN, TH, RU) display labels
 * for project types, organization roles, facilities, sleeping arrangements,
 * views, tenure types, compliance statuses, and eligibility reasons.
 */

export type SupportedLocale = 'en' | 'th' | 'ru';

export interface TaxonomyEntry {
  key: string;
  labels: Record<SupportedLocale, string>;
}

export const PROJECT_TYPES: Record<string, TaxonomyEntry> = {
  resort: {
    key: 'resort',
    labels: { en: 'Resort', th: 'รีสอร์ท', ru: 'Курорт' },
  },
  hotel: {
    key: 'hotel',
    labels: { en: 'Hotel', th: 'โรงแรม', ru: 'Отель' },
  },
  villa_estate: {
    key: 'villa_estate',
    labels: { en: 'Villa Estate', th: 'โครงการวิลล่า', ru: 'Поселок вилл' },
  },
  condominium: {
    key: 'condominium',
    labels: { en: 'Condominium', th: 'คอนโดมิเนียม', ru: 'Кондоминиум' },
  },
  serviced_residence: {
    key: 'serviced_residence',
    labels: { en: 'Serviced Residence', th: 'เซอร์วิสเรสซิเดนซ์', ru: 'Сервисные апартаменты' },
  },
  apartment_building: {
    key: 'apartment_building',
    labels: { en: 'Apartment Building', th: 'อาคารอพาร์ตเมนต์', ru: 'Многоквартирный дом' },
  },
  mixed_use: {
    key: 'mixed_use',
    labels: { en: 'Mixed-Use Development', th: 'โครงการมิกซ์ยูส', ru: 'Многофункциональный комплекс' },
  },
  residential_development: {
    key: 'residential_development',
    labels: { en: 'Residential Development', th: 'โครงการที่อยู่อาศัย', ru: 'Жилой комплекс' },
  },
};

export const ORGANIZATION_ROLES: Record<string, TaxonomyEntry> = {
  developer: {
    key: 'developer',
    labels: { en: 'Developer', th: 'ผู้พัฒนาโครงการ', ru: 'Застройщик' },
  },
  co_developer: {
    key: 'co_developer',
    labels: { en: 'Co-Developer', th: 'ผู้ร่วมพัฒนาโครงการ', ru: 'Созастройщик' },
  },
  operator: {
    key: 'operator',
    labels: { en: 'Hospitality Operator', th: 'ผู้บริหารจัดการโรงแรม', ru: 'Отельный оператор' },
  },
  management_company: {
    key: 'management_company',
    labels: { en: 'Management Company', th: 'บริษัทบริหารจัดการ', ru: 'Управляющая компания' },
  },
  juristic_person: {
    key: 'juristic_person',
    labels: { en: 'Juristic Person', th: 'นิติบุคคล', ru: 'Юридическое лицо / ТСЖ' },
  },
  landowner: {
    key: 'landowner',
    labels: { en: 'Landowner', th: 'เจ้าของที่ดิน', ru: 'Собственник земли' },
  },
  architect: {
    key: 'architect',
    labels: { en: 'Architect & Designer', th: 'สถาปนิก/ผู้ออกแบบ', ru: 'Архитектор' },
  },
  contractor: {
    key: 'contractor',
    labels: { en: 'Main Contractor', th: 'ผู้รับเหมาหลัก', ru: 'Генеральный подрядчик' },
  },
};

export const PROJECT_FACILITIES: Record<string, TaxonomyEntry> = {
  reception: {
    key: 'reception',
    labels: { en: 'Reception / Front Desk', th: 'แผนกต้อนรับ', ru: 'Стойка регистрации' },
  },
  security: {
    key: 'security',
    labels: { en: '24/7 Security & CCTV', th: 'ระบบรักษาความปลอดภัย 24 ชม.', ru: 'Круглосуточная охрана' },
  },
  parking: {
    key: 'parking',
    labels: { en: 'Parking', th: 'ที่จอดรถ', ru: 'Парковка' },
  },
  restaurant: {
    key: 'restaurant',
    labels: { en: 'Restaurant & Dining', th: 'ร้านอาหาร', ru: 'Ресторан' },
  },
  spa: {
    key: 'spa',
    labels: { en: 'Spa & Wellness', th: 'สปาและเวลเนส', ru: 'Спа и wellness' },
  },
  common_pools: {
    key: 'common_pools',
    labels: { en: 'Swimming Pool', th: 'สระว่ายน้ำส่วนกลาง', ru: 'Общий бассейн' },
  },
  fitness: {
    key: 'fitness',
    labels: { en: 'Fitness Center', th: 'ฟิตเนส', ru: 'Фитнес-центр' },
  },
  coworking: {
    key: 'coworking',
    labels: { en: 'Co-Working Space', th: 'โคเวิร์กกิ้งสเปซ', ru: 'Коворкинг' },
  },
  children_facilities: {
    key: 'children_facilities',
    labels: { en: 'Kids Club & Playground', th: 'สโมสรเด็กและสนามเด็กเล่น', ru: 'Детский клуб' },
  },
  shuttle: {
    key: 'shuttle',
    labels: { en: 'Shuttle Service', th: 'บริการรถรับส่ง', ru: 'Трансфер' },
  },
  beach_access: {
    key: 'beach_access',
    labels: { en: 'Direct Beach Access', th: 'ทางเข้าหาดโดยตรง', ru: 'Прямой выход к пляжу' },
  },
};

export const BED_TYPES: Record<string, TaxonomyEntry> = {
  king: {
    key: 'king',
    labels: { en: 'King Bed', th: 'เตียงคิงไซส์', ru: 'Кровать King Size' },
  },
  queen: {
    key: 'queen',
    labels: { en: 'Queen Bed', th: 'เตียงควีนไซส์', ru: 'Кровать Queen Size' },
  },
  double: {
    key: 'double',
    labels: { en: 'Double Bed', th: 'เตียงคู่', ru: 'Двуспальная кровать' },
  },
  single: {
    key: 'single',
    labels: { en: 'Single / Twin Bed', th: 'เตียงเดี่ยว', ru: 'Односпальная кровать' },
  },
  bunk: {
    key: 'bunk',
    labels: { en: 'Bunk Bed', th: 'เตียงสองชั้น', ru: 'Двухъярусная кровать' },
  },
  sofa_bed: {
    key: 'sofa_bed',
    labels: { en: 'Sofa Bed', th: 'โซฟาเบด', ru: 'Диван-кровать' },
  },
  futon: {
    key: 'futon',
    labels: { en: 'Futon', th: 'ฟูกที่นอน', ru: 'Футон' },
  },
  crib: {
    key: 'crib',
    labels: { en: 'Baby Crib', th: 'เตียงเด็กอ่อน', ru: 'Детская кроватка' },
  },
};

export const VIEWS: Record<string, TaxonomyEntry> = {
  sea: {
    key: 'sea',
    labels: { en: 'Sea / Ocean View', th: 'วิวทะเล', ru: 'Вид на море' },
  },
  mountain: {
    key: 'mountain',
    labels: { en: 'Mountain View', th: 'วิวภูเขา', ru: 'Вид на горы' },
  },
  pool: {
    key: 'pool',
    labels: { en: 'Pool View', th: 'วิวสระว่ายน้ำ', ru: 'Вид на бассейн' },
  },
  garden: {
    key: 'garden',
    labels: { en: 'Garden View', th: 'วิวสวน', ru: 'Вид на сад' },
  },
  city: {
    key: 'city',
    labels: { en: 'City View', th: 'วิวเมือง', ru: 'Вид на город' },
  },
  lake: {
    key: 'lake',
    labels: { en: 'Lake View', th: 'วิวทะเลสาบ', ru: 'Вид на озеро' },
  },
  golf: {
    key: 'golf',
    labels: { en: 'Golf Course View', th: 'วิวสนามกอล์ฟ', ru: 'Вид на гольф-поле' },
  },
  courtyard: {
    key: 'courtyard',
    labels: { en: 'Courtyard View', th: 'วิวลานกว้าง', ru: 'Вид во двор' },
  },
};

export const OWNERSHIP_TENURES: Record<string, TaxonomyEntry> = {
  freehold: {
    key: 'freehold',
    labels: { en: 'Freehold', th: 'ฟรีโฮลด์ (กรรมสิทธิ์สมบูรณ์)', ru: 'Фрихолд (Собственность)' },
  },
  leasehold: {
    key: 'leasehold',
    labels: { en: 'Leasehold', th: 'สิทธิการเช่าระยะยาว', ru: 'Лизхолд (Долгосрочная аренда)' },
  },
  foreign_quota: {
    key: 'foreign_quota',
    labels: { en: 'Foreign Quota Freehold', th: 'โควต้าต่างชาติ', ru: 'Иностранная квота' },
  },
};

export const BLOCKING_REASONS: Record<string, TaxonomyEntry> = {
  PROPERTY_FACTS_INCOMPLETE: {
    key: 'PROPERTY_FACTS_INCOMPLETE',
    labels: {
      en: 'Property physical facts are incomplete',
      th: 'ข้อมูลกายภาพของอสังหาริมทรัพย์ยังไม่สมบูรณ์',
      ru: 'Физические данные объекта не заполнены',
    },
  },
  REQUIRED_CREDENTIAL_MISSING: {
    key: 'REQUIRED_CREDENTIAL_MISSING',
    labels: {
      en: 'Required regulatory credential (hotel licence or exemption) is missing or expired',
      th: 'ขาดใบอนุญาตประกอบธุรกิจโรงแรมหรือหนังสือแจ้งยกเว้นตามกฎหมาย',
      ru: 'Отсутствует отельная лицензия или действующее разрешение',
    },
  },
  SLEEPING_LAYOUT_INCOMPLETE: {
    key: 'SLEEPING_LAYOUT_INCOMPLETE',
    labels: {
      en: 'Sleeping arrangements or bed configurations are incomplete',
      th: 'ข้อมูลการจัดห้องนอนและประเภทเตียงยังไม่สมบูรณ์',
      ru: 'Не указана конфигурация спальных мест',
    },
  },
  CHANNEL_REQUIRED_FIELD_MISSING: {
    key: 'CHANNEL_REQUIRED_FIELD_MISSING',
    labels: {
      en: 'Mandatory field for this distribution channel is missing',
      th: 'ขาดข้อมูลที่จำเป็นสำหรับช่องทางการขายนี้',
      ru: 'Отсутствуют обязательные поля для данного канала продаж',
    },
  },
};

export function getLabel(
  taxonomy: Record<string, TaxonomyEntry>,
  key: string,
  locale: SupportedLocale = 'en'
): string {
  const entry = taxonomy[key];
  if (!entry) return key;
  return entry.labels[locale] || entry.labels.en || key;
}
