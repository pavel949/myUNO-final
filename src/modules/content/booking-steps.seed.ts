/** Booking progress indicator copy (review → optional approval → pay → confirmed). Drafts (needs_review). */
export const BOOKING_STEPS_KEYS = [
  { key: 'booking.steps.aria', namespace: 'booking', description: 'Booking progress indicator accessible name', en: 'Booking progress', ru: 'Ход бронирования', th: 'ขั้นตอนการจอง', zh: 'Booking progress', status: 'needs_review' as const },
  { key: 'booking.steps.review', namespace: 'booking', description: 'Booking step 1: review details and price', en: 'Review', ru: 'Проверка', th: 'ตรวจสอบ', zh: 'Review', status: 'needs_review' as const },
  { key: 'booking.steps.approval', namespace: 'booking', description: 'Request-only booking step: property approval before payment', en: 'Approval', ru: 'Одобрение', th: 'อนุมัติ', zh: '审核', status: 'needs_review' as const },
  { key: 'booking.steps.pay', namespace: 'booking', description: 'Booking step 2: payment', en: 'Pay', ru: 'Оплата', th: 'ชำระเงิน', zh: 'Pay', status: 'needs_review' as const },
  { key: 'booking.steps.confirmed', namespace: 'booking', description: 'Booking step 3: confirmation', en: 'Confirmed', ru: 'Подтверждено', th: 'ยืนยันแล้ว', zh: 'Confirmed', status: 'needs_review' as const },
  { key: 'booking.steps.current', namespace: 'booking', description: 'Screen-reader suffix for the current step', en: 'current step', ru: 'текущий шаг', th: 'ขั้นตอนปัจจุบัน', zh: 'current step', status: 'needs_review' as const },
];


export const BOOKING_STEPS_DRAFTS = Object.fromEntries(BOOKING_STEPS_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, th: row.th, zh: row.zh }]));
