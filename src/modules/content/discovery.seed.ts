export function discoveryDefaults(locale: string) {
  const copy = {
    en: { browse: 'Explore homes', note: 'Choose dates to check availability and the total price.', pending: 'Online booking is being prepared. Ask us about this home.', photos: 'Photos are being prepared', open: 'View home', project: 'View residence', guests: 'guests', bedrooms: 'bedrooms', empty: 'No homes match this selection.', ask: 'Ask about this home' },
    ru: { browse: 'Выберите жильё', note: 'Выберите даты, чтобы проверить доступность и полную стоимость.', pending: 'Онлайн-бронирование готовится. Уточните условия у команды.', photos: 'Фотографии готовятся', open: 'Смотреть объект', project: 'Открыть комплекс', guests: 'гостей', bedrooms: 'спальни', empty: 'По вашему выбору объекты не найдены.', ask: 'Уточнить условия' },
    th: { browse: 'เลือกที่พัก', note: 'เลือกวันที่เพื่อตรวจสอบห้องว่างและราคารวม', pending: 'กำลังเตรียมการจองออนไลน์ กรุณาสอบถามทีมงาน', photos: 'กำลังเตรียมรูปภาพ', open: 'ดูที่พัก', project: 'ดูโครงการ', guests: 'ผู้เข้าพัก', bedrooms: 'ห้องนอน', empty: 'ไม่พบที่พักตามที่เลือก', ask: 'สอบถามที่พักนี้' },
    zh: { browse: '探索住宿', note: '选择日期以查看可订情况和总价。', pending: '正在准备在线预订。请向团队咨询此房源。', photos: '照片准备中', open: '查看房源', project: '查看项目', guests: '位客人', bedrooms: '间卧室', empty: '没有符合所选条件的房源。', ask: '咨询此房源' },
  };
  return copy[locale as keyof typeof copy] ?? copy.en;
}

export const DISCOVERY_KEYS = Object.entries(discoveryDefaults('en')).map(([key, en]) => ({
  key: `discovery.${key}`, namespace: 'discovery', description: `Public property discovery: ${key}`,
  en, ru: discoveryDefaults('ru')[key as keyof ReturnType<typeof discoveryDefaults>],
  th: discoveryDefaults('th')[key as keyof ReturnType<typeof discoveryDefaults>],
  zh: discoveryDefaults('zh')[key as keyof ReturnType<typeof discoveryDefaults>], status: 'needs_review' as const,
}));
