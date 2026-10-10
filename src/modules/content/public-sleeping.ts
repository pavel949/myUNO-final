/** Localized defaults for public documentary sleeping facts; no CMS writes. */
const copy = {
  en: { title: 'Sleeping arrangements', bedroom: 'Bedroom', living_room: 'Living room', double: 'Double bed (size unspecified)', king: 'King bed', queen: 'Queen bed', single: 'Single bed', sofa_bed: 'Sofa bed' },
  ru: { title: 'Спальные места', bedroom: 'Спальня', living_room: 'Гостиная', double: 'Двуспальная кровать (размер не уточнён)', king: 'Кровать king-size', queen: 'Кровать queen-size', single: 'Односпальная кровать', sofa_bed: 'Диван-кровать' },
  th: { title: 'การจัดเตียงนอน', bedroom: 'ห้องนอน', living_room: 'ห้องนั่งเล่น', double: 'เตียงคู่ (ไม่ระบุขนาด)', king: 'เตียงคิงไซส์', queen: 'เตียงควีนไซส์', single: 'เตียงเดี่ยว', sofa_bed: 'โซฟาเบด' },
  zh: { title: '睡眠安排', bedroom: '卧室', living_room: '客厅', double: '双人床（尺寸未注明）', king: '特大床', queen: '大床', single: '单人床', sofa_bed: '沙发床' },
};
export function publicSleepingLabelsForLocale(locale: string): Record<string, string> {
  const selected = locale === 'ru' || locale === 'th' || locale === 'zh' ? locale : 'en';
  return Object.fromEntries(Object.entries(copy[selected]).map(([key, value]) => [`listing.sleeping.${key}`, value]));
}
