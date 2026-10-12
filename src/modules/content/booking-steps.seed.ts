/** Booking progress indicator copy (review → pay → confirmed). Drafts (needs_review). */
export const BOOKING_STEPS_KEYS = [
  { key: 'booking.steps.aria', namespace: 'booking', description: 'Booking progress indicator accessible name', en: 'Booking progress', ru: 'Ход бронирования', th: 'ขั้นตอนการจอง', zh: 'Booking progress', status: 'needs_review' as const },
  { key: 'booking.steps.review', namespace: 'booking', description: 'Booking step 1: review details and price', en: 'Review', ru: 'Проверка', th: 'ตรวจสอบ', zh: 'Review', status: 'needs_review' as const },
  { key: 'booking.steps.pay', namespace: 'booking', description: 'Booking step 2: payment', en: 'Pay', ru: 'Оплата', th: 'ชำระเงิน', zh: 'Pay', status: 'needs_review' as const },
  { key: 'booking.steps.confirmed', namespace: 'booking', description: 'Booking step 3: confirmation', en: 'Confirmed', ru: 'Подтверждено', th: 'ยืนยันแล้ว', zh: 'Confirmed', status: 'needs_review' as const },
  { key: 'booking.steps.current', namespace: 'booking', description: 'Screen-reader suffix for the current step', en: 'current step', ru: 'текущий шаг', th: 'ขั้นตอนปัจจุบัน', zh: 'current step', status: 'needs_review' as const },
];
